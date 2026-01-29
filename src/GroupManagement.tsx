import { ReactElement, createElement, useState, useCallback, useEffect, useMemo } from "react";
import { Big } from "big.js";
import { GroupManagementContainerProps } from "../typings/GroupManagementProps";
import { GroupTreeContainer } from "./components/GroupTree/GroupTreeContainer";
import { useGroupTreeData } from "./hooks/useGroupTreeData";
import { useLocalStorageSync } from "./hooks/useLocalStorageSync";
import { GroupTreeItemMap } from "./types/groupTree.types";
import "./ui/GroupManagement.css";

export function GroupManagement(props: GroupManagementContainerProps): ReactElement {
    const {
        groupDataSource,
        groupNameAttr,
        parentIdAttr,
        sortNoAttr,
        depthAttr,
        descriptionAttr,
        enableAttr,
        groupIdAttr,
        onTreeChange
    } = props;

    // Mendix attribute configuration memoization
    const config = useMemo(() => ({
        groupNameAttr,
        parentIdAttr,
        sortNoAttr,
        depthAttr,
        descriptionAttr,
        enableAttr,
        groupIdAttr
    }), [
        groupNameAttr,
        parentIdAttr,
        sortNoAttr,
        depthAttr,
        descriptionAttr,
        enableAttr,
        groupIdAttr
    ]);

    // Mendix datasource에서 데이터를 트리 형식으로 변환 (베이스 트리)
    const baseTree = useGroupTreeData(groupDataSource?.items, config);

    // 표시/조작용 트리 상태 (드래그 결과가 즉시 반영되도록 유지)
    const [treeItems, setTreeItems] = useState<GroupTreeItemMap>(baseTree);
    const [previousTreeItems, setPreviousTreeItems] = useState<GroupTreeItemMap>(baseTree);

    // localStorage 동기화 훅
    const { saveChanges, getChangesList } = useLocalStorageSync();

    // Mendix 데이터(베이스 트리)가 바뀌면 위젯 트리를 서버 기준으로 동기화
    useEffect(() => {
        setTreeItems(baseTree);
        setPreviousTreeItems(baseTree);
    }, [baseTree]);

    // 변경사항을 DB에 저장하는 함수 (분리)
    const commitChanges = useCallback(
        async (
            newItems: GroupTreeItemMap,
            prevItems: GroupTreeItemMap,
            changes: ReturnType<typeof getChangesList>
        ) => {
            // 트리 상태 업데이트
            setTreeItems(newItems);
            setPreviousTreeItems(newItems);
            saveChanges(newItems, prevItems);

            // mx.data.commit으로 직접 DB 저장
            if (changes.length > 0 && groupDataSource?.items) {
                const mx = (window as any).mx;
                if (!mx?.data?.commit) {
                    console.error("mx.data.commit is not available");
                    return;
                }

                // 모든 변경사항에 대해 개별 Promise 생성
                const loadAndModifyPromises = changes.map(change => {
                    return new Promise<any>((resolve) => {
                        // 1. groupDataSource에서 객체 찾기
                        const item = groupDataSource.items?.find((obj: any) => {
                            // groupIdAttr prop이 있으면 그것을 우선 사용
                            if (groupIdAttr) {
                                try {
                                    const val = groupIdAttr.get(obj).value;
                                    if (val != null && String(val) === change.groupId) return true;
                                } catch (e) { }
                            }

                            // 차선책: 일반적인 ID 속성명으로 찾기
                            if (typeof obj.get === "function") {
                                const idNames = ["Groupld", "GroupId", "groupid", "groupId"];
                                for (const name of idNames) {
                                    try {
                                        const val = obj.get(name);
                                        const stringVal = val != null ? (typeof val === "object" ? String(val.value) : String(val)) : null;
                                        if (stringVal === change.groupId) return true;
                                    } catch (e) { }
                                }
                            }

                            // 최후의 수단: Mendix GUID 매칭
                            return obj.id === change.groupId;
                        }) as any;

                        if (!item) {
                            console.warn(`[Commit] Item not found for groupId: ${change.groupId}`);
                            resolve(null);
                            return;
                        }

                        // 2. Mendix 객체 로드 및 수정
                        const guid = item.id || item.guid || item.GUID;
                        const modifyObject = (mxobj: any) => {
                            try {
                                const attrs = mxobj.getAttributes();

                                // 대소문자 구분 없이 속성명 매칭하여 값 설정 시도
                                const setAttr = (search: string, value: any) => {
                                    const exact = attrs.find((a: string) => a.toLowerCase() === search.toLowerCase());
                                    if (exact) {
                                        mxobj.set(exact, value);
                                        return true;
                                    }
                                    return false;
                                };

                                setAttr("ParentId", change.parentId);
                                setAttr("SortNo", new Big(change.sortNo));
                                setAttr("Depth", new Big(change.depth));

                                console.log(`[Commit] Set values for ${change.groupId}: parent=${change.parentId}, sort=${change.sortNo}, depth=${change.depth}`);
                                resolve(mxobj);
                            } catch (error) {
                                console.error(`[Commit] Failed to set values for ${change.groupId}:`, error);
                                resolve(null);
                            }
                        };

                        // 객체가 이미 로드되어 있으면 바로 수정, 아니면 로드 후 수정
                        if (typeof item.get === "function" && typeof item.set === "function") {
                            modifyObject(item);
                        } else if (mx?.data?.get) {
                            mx.data.get({
                                guid: guid,
                                callback: modifyObject,
                                error: (err: any) => {
                                    console.error(`[Commit] Failed to load object ${guid}:`, err);
                                    resolve(null);
                                }
                            });
                        } else {
                            resolve(null);
                        }
                    });
                });

                // 모든 객체 로드 및 수정 완료 후 커밋
                try {
                    const changedObjects = await Promise.all(loadAndModifyPromises);
                    const validObjects = changedObjects.filter(obj => obj !== null);

                    if (validObjects.length === 0) {
                        console.warn("No valid objects to commit");
                        return;
                    }

                    // mx.data.commit 호출
                    // Mendix API는 mxobj 또는 mxobjs 파라미터를 요구함
                    const commitPromise = new Promise<void>((resolve, reject) => {
                        try {
                            // 여러 객체를 커밋하는 경우 mxobjs 사용
                            const commitResult = mx.data.commit({
                                mxobjs: validObjects,
                                callback: () => {
                                    console.log(`Successfully committed ${validObjects.length} objects to Mendix DB`);
                                    resolve();
                                },
                                error: (error: any) => {
                                    console.error("Failed to commit changes to Mendix:", error);
                                    reject(error);
                                }
                            });

                            // Promise를 반환하는 경우 (Mendix 10+)
                            if (commitResult instanceof Promise) {
                                commitResult
                                    .then(() => {
                                        console.log(`Successfully committed ${validObjects.length} objects to Mendix DB`);
                                        resolve();
                                    })
                                    .catch(reject);
                            }
                            // 콜백만 사용하는 경우는 위의 callback/error가 처리
                        } catch (error) {
                            reject(error);
                        }
                    });

                    await commitPromise;

                    // 성공 시 데이터 소스 리프레시하여 최신 데이터 로드
                    // 약간의 지연을 두어 서버가 커밋을 처리할 시간 제공
                    setTimeout(() => {
                        if (groupDataSource.reload) {
                            groupDataSource.reload();
                        }
                        // 리프레시 후 트리 구조가 업데이트되도록 약간의 추가 지연
                        // baseTree가 업데이트되면 useEffect에서 자동으로 treeItems가 동기화됨
                    }, 500);
                } catch (error) {
                    console.error("Failed to commit changes to Mendix:", error);
                    // 에러 발생 시 사용자에게 알림
                    const mxWindow = (window as any).mx;
                    if (mxWindow?.window?.alert) {
                        mxWindow.window.alert("변경사항 저장에 실패했습니다. 다시 시도해주세요.");
                    }
                }
            }
            if (onTreeChange && onTreeChange.canExecute && !onTreeChange.isExecuting) {
                const changesJson = JSON.stringify(changes);
                onTreeChange.execute({ changesJson });
            }

        },
        [saveChanges, groupDataSource, onTreeChange]
    );

    // 트리 변경 핸들러 (드래그 등)
    const handleTreeChange = useCallback(
        (newItems: GroupTreeItemMap) => {
            const changes = getChangesList(newItems, previousTreeItems);

            // 변경사항이 없으면 바로 반영
            if (changes.length === 0) {
                setTreeItems(newItems);
                setPreviousTreeItems(newItems);
                return;
            }

            // 변경사항이 있으면 확인 다이얼로그 표시
            const mx = (window as any).mx;
            if (mx?.window?.confirm) {
                mx.window.confirm(
                    `${changes.length}개의 그룹 구조 변경사항을 저장하시겠습니까?`,
                    (confirmed: boolean) => {
                        if (confirmed) {
                            // 확인 시 저장 로직 실행
                            commitChanges(newItems, previousTreeItems, changes);
                        } else {
                            // 취소 시 이전 상태로 롤백
                            setTreeItems(previousTreeItems);
                        }
                    }
                );
            } else {
                // mx.window가 없으면 바로 저장
                commitChanges(newItems, previousTreeItems, changes);
            }
        },
        [getChangesList, previousTreeItems, commitChanges]
    );

    // 아이템 삭제 핸들러
    const handleRemoveItem = useCallback(
        (itemId: string) => {
            const newItems = { ...treeItems };
            const item = newItems[itemId];

            if (item) {
                const parentId = item.data.parentId || "__group_root__";
                const parent = newItems[parentId];
                if (parent && parent.children) {
                    newItems[parentId] = {
                        ...parent,
                        children: parent.children.filter(id => id !== itemId)
                    };
                }
                delete newItems[itemId];
                handleTreeChange(newItems);
            }
        },
        [treeItems, handleTreeChange]
    );

    // 하위 폴더 추가 핸들러
    const handleAddSubFolder = useCallback((parentId: string | null) => {
        if (!parentId) return;

        // 임시 ID 생성 (실제 ID는 저장 후 서버에서 생성되거나 GUID 사용)
        const tempId = `new_folder_${Date.now()}`;
        const newItems = { ...treeItems };
        const parent = newItems[parentId];

        // 새 아이템 생성
        // 부모의 depth + 1
        const newDepth = (parent?.data.depth ?? 0) + 1;

        // 형제들 중 가장 마지막 sortNo + 1
        let maxSortNo = 0;
        if (parent?.children) {
            parent.children.forEach(childId => {
                const child = newItems[childId];
                if (child && child.data.sortNo > maxSortNo) {
                    maxSortNo = child.data.sortNo;
                }
            });
        }

        newItems[tempId] = {
            index: tempId,
            isFolder: true,
            children: [],
            data: {
                groupId: tempId,
                groupName: "New Folder",
                parentId: parentId,
                sortNo: maxSortNo + 1,
                depth: newDepth,
                description: "",
                enabledTF: true,
                leftNo: 0,
                rightNo: 0,
                displayYn: "Y"
            },
            canMove: true,
            canRename: true
        };

        // 부모의 자식 목록에 추가
        if (parent) {
            const newChildren = [...(parent.children || []), tempId];
            newItems[parentId] = {
                ...parent,
                children: newChildren
            };

            // 트리 변경 통지 및 저장
            // 여기서는 단순 추가이므로 별도의 처리 로직이 필요할 수 있음
            // 현재 구조상 handleTreeChange를 통해 변경사항을 감지하고 저장하도록 유도

            // 변경사항 계산을 위해 change 리스트 직접 생성
            const change = {
                groupId: tempId,
                parentId: parentId,
                sortNo: maxSortNo + 1,
                depth: newDepth,
                type: "create" // 새로 추가됨을 표시 (실제 구현에서는 이 타입을 처리해야 함)
            };
            console.log("Created new folder structure:", change);

            // Mendix 객체 생성 로직은 복잡하므로,
            // 여기서는 간단히 사용자에게 알림만 주거나,
            // 실제 구현에서는 Mendix Microflow를 호출하여 객체를 생성하고 리프레시해야 함

            setTreeItems(newItems);

            const mx = (window as any).mx;
            if (mx && mx.ui && mx.ui.info) {
                mx.ui.info("새 폴더가 트리에 추가되었습니다. 저장을 위해 '변경사항 저장' 프로세스가 필요할 수 있습니다.", true);
            }
        }
    }, [treeItems]);

    if (!groupDataSource) {
        return (
            <div className="group-management-widget">
                <p>데이터 소스를 설정해주세요.</p>
            </div>
        );
    }

    return (
        <div className="group-management-widget">
            <GroupTreeContainer
                treeItems={treeItems}
                onTreeChange={handleTreeChange}
                onRemoveItem={handleRemoveItem}
                onAddSubFolder={handleAddSubFolder}
            />
        </div>
    );
}
