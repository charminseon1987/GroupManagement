import { ReactElement, createElement, useState, useCallback, useEffect } from "react";
import { GroupManagementContainerProps } from "../typings/GroupManagementProps";
import { GroupTreeContainer } from "./components/GroupTree/GroupTreeContainer";
import { useGroupTreeData } from "./hooks/useGroupTreeData";
import { useLocalStorageSync } from "./hooks/useLocalStorageSync";
import { GroupTreeItemMap } from "./types/groupTree.types";
import "./ui/GroupManagement.css";

export function GroupManagement({ groupDataSource }: GroupManagementContainerProps): ReactElement {
    // Mendix datasource에서 데이터를 트리 형식으로 변환 (베이스 트리)
    const baseTree = useGroupTreeData(groupDataSource?.items);

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

                // Promise.all을 사용하여 모든 객체를 로드하고 수정
                const loadAndModifyPromises = changes.map(change => {
                    return new Promise<any>((resolve, _reject) => {
                        // groupDataSource.items에서 groupId로 객체 찾기
                        const item = groupDataSource.items?.find((obj: any) => {
                            // 여러 방법으로 ID 추출 시도
                            let id: string | undefined;
                            const objAny = obj as any;
                            if (typeof objAny.get === "function") {
                                const groupIdValue = objAny.get("Groupld");
                                id = typeof groupIdValue === "string" 
                                    ? groupIdValue 
                                    : (groupIdValue?.value != null ? String(groupIdValue.value) : undefined);
                            }
                            if (!id) {
                                id = objAny.Groupld?.value || objAny.Groupld || objAny.id?.value || objAny.id;
                            }
                            return id === change.groupId;
                        }) as any;

                        if (!item) {
                            console.warn(`Item not found for groupId: ${change.groupId}`);
                            resolve(null);
                            return;
                        }

                        // GUID 추출
                        const guid = item.id || item.guid || item.GUID;
                        if (!guid) {
                            console.warn(`GUID not found for item:`, item);
                            resolve(null);
                            return;
                        }

                        // 실제 객체가 이미 있는지 확인 (get() 메서드가 있고 set() 메서드도 있는 경우)
                        if (typeof item.get === "function" && typeof item.set === "function") {
                            // 이미 실제 객체인 경우 직접 수정
                            try {
                                // 디버깅: 사용 가능한 속성 확인
                                if (process.env.NODE_ENV === "development" && changes.indexOf(change) === 0) {
                                    console.log("Mendix object properties:", {
                                        hasGet: typeof item.get === "function",
                                        hasSet: typeof item.set === "function",
                                        availableAttrs: Object.keys(item).filter(k => !k.startsWith("_") && typeof item[k] !== "function"),
                                        sampleGet: item.get ? (() => {
                                            try {
                                                const attrs = ["GroupName", "groupName", "Group_Name", "Name", "name"];
                                                const found: any = {};
                                                attrs.forEach(attr => {
                                                    try {
                                                        const val = item.get(attr);
                                                        if (val !== undefined) found[attr] = val;
                                                    } catch (e) {}
                                                });
                                                return found;
                                            } catch (e) {
                                                return "error";
                                            }
                                        })() : "no get method"
                                    });
                                }
                                
                                item.set("ParentId", change.parentId);
                                item.set("SortNo", change.sortNo);
                                item.set("Depth", change.depth);
                                resolve(item);
                            } catch (error) {
                                console.error(`Failed to modify object directly:`, error);
                                resolve(null);
                            }
                            return;
                        }

                        // mx.data.get()으로 실제 객체 로드
                        // Mendix API: mx.data.get({ guid: string, callback: function, error: function })
                        if (mx?.data?.get) {
                            mx.data.get({
                                guid: guid,
                                callback: (mxobj: any) => {
                                    if (!mxobj) {
                                        console.warn(`Failed to load object with GUID: ${guid}`);
                                        resolve(null);
                                        return;
                                    }
                                    try {
                                        // 속성 변경
                                        mxobj.set("ParentId", change.parentId);
                                        mxobj.set("SortNo", change.sortNo);
                                        mxobj.set("Depth", change.depth);
                                        resolve(mxobj);
                                    } catch (error) {
                                        console.error(`Failed to modify object ${guid}:`, error);
                                        resolve(null);
                                    }
                                },
                                error: (error: any) => {
                                    console.error(`Failed to load object ${guid}:`, error);
                                    resolve(null);
                                }
                            });
                        } else {
                            console.error("mx.data.get is not available");
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
        },
        [saveChanges, groupDataSource]
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
        console.log("Add sub folder to:", parentId);
    }, []);

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
