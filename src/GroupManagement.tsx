import { ReactElement, createElement, useState, useCallback, useEffect, useMemo } from "react";
import { Big } from "big.js";
import { GroupManagementContainerProps } from "../typings/GroupManagementProps";
import { GroupTreeContainer } from "./components/GroupTree/GroupTreeContainer";
import { useGroupTreeData } from "./hooks/useGroupTreeData";
import { useLocalStorageSync } from "./hooks/useLocalStorageSync";
import { GroupTreeItemMap, GroupTreeChange } from "./types/groupTree.types";
import { TreeItemIndex } from "react-complex-tree";
import "./ui/GroupManagement.css";
import "./ui/GroupManagement.scss";

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

    const [treeItems, setTreeItems] = useState<GroupTreeItemMap>(baseTree);
    const [previousTreeItems, setPreviousTreeItems] = useState<GroupTreeItemMap>(baseTree);
    const [renamingItemId, setRenamingItemId] = useState<TreeItemIndex | null>(null);

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
            changes: GroupTreeChange[]
        ) => {
            // 트리 상태 업데이트
            setTreeItems(newItems);
            setPreviousTreeItems(newItems);
            saveChanges(newItems, prevItems);

            if (changes.length > 0 && groupDataSource?.items) {
                const mx = (window as any).mx;
                if (!mx?.data?.commit) {
                    console.error("mx.data.commit is not available");
                    return;
                }

                try {
                    // 모든 변경사항에 대해 개별 Promise 생성
                    const loadAndModifyPromises = changes.map(change => {
                        return new Promise<any>((resolve) => {
                            const modifyObject = (mxobj: any) => {
                                try {
                                    const attrs = mxobj.getAttributes();
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
                                    if (change.groupName !== undefined) {
                                        setAttr("GroupName", change.groupName);
                                    }

                                    console.log(`[Commit] Prepared object for ${change.groupId}`);
                                    resolve(mxobj);
                                } catch (error) {
                                    console.error(`[Commit] Failed to set values:`, error);
                                    resolve(null);
                                }
                            };

                            if (change.type === "create") {
                                const firstItem = (groupDataSource.items && groupDataSource.items.length > 0) ? groupDataSource.items[0] : null;
                                if (firstItem) {
                                    const entityName = (firstItem as any).entity || (firstItem as any).getEntity?.();
                                    if (entityName) {
                                        mx.data.create({
                                            entity: entityName,
                                            callback: modifyObject,
                                            error: (err: any) => {
                                                console.error(`[Commit] Creation failed:`, err);
                                                resolve(null);
                                            }
                                        });
                                        return;
                                    }
                                }
                                resolve(null);
                                return;
                            }

                            const item = groupDataSource.items?.find(obj => {
                                if (obj.id === change.groupId) return true;
                                if (groupIdAttr) {
                                    try {
                                        const val = groupIdAttr.get(obj).value;
                                        if (val != null && String(val) === change.groupId) return true;
                                    } catch (e) { }
                                }
                                return false;
                            });

                            if (!item) {
                                resolve(null);
                                return;
                            }

                            if (typeof (item as any).get === "function" && typeof (item as any).set === "function") {
                                modifyObject(item);
                            } else {
                                mx.data.get({
                                    guid: item.id,
                                    callback: modifyObject,
                                    error: (err: any) => {
                                        console.error(`[Commit] Failed to load object ${item.id}:`, err);
                                        resolve(null);
                                    }
                                });
                            }
                        });
                    });

                    const changedObjects = await Promise.all(loadAndModifyPromises);
                    const validObjects = changedObjects.filter(obj => obj !== null);

                    if (validObjects.length > 0) {
                        await new Promise<void>((resolveCommit, rejectCommit) => {
                            mx.data.commit({
                                mxobjs: validObjects,
                                callback: () => {
                                    console.log(`Successfully committed ${validObjects.length} objects`);
                                    resolveCommit();
                                },
                                error: (error: any) => {
                                    console.error("Failed to commit changes:", error);
                                    rejectCommit(error);
                                }
                            });
                        });

                        setTimeout(() => {
                            if (groupDataSource.reload) {
                                groupDataSource.reload();
                            }
                        }, 500);
                    }
                } catch (error) {
                    console.error("Error during commit process:", error);
                }
            }

            // 추가 명령 실행 (onTreeChange)
            if (onTreeChange && onTreeChange.canExecute && !onTreeChange.isExecuting) {
                const changesJson = JSON.stringify(changes);
                onTreeChange.execute({ changesJson });
            }
        },
        [saveChanges, groupDataSource, onTreeChange, groupIdAttr]
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
            // 단, 이름 변경만 있거나 새로 추가된 항목의 경우 바로 저장 (사용자 경험 개선)
            const isSimpleChange = changes.every(c => c.type === "create" || (c.type === "update" && c.groupName !== undefined));

            const mx = (window as any).mx;
            if (mx?.window?.confirm && !isSimpleChange) {
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

                // 새로운 아이템인 경우 롤백이 필요할 수도 있지만, 
                // 여기서는 단순히 트리 상태에서 제거하고 handleTreeChange를 통해 전파
                handleTreeChange(newItems);
            }
        },
        [treeItems, handleTreeChange]
    );

    // 하위 폴더 추가 핸들러
    const handleAddSubFolder = useCallback((parentId: string | null) => {
        if (!parentId) return;

        const tempId = `new_folder_${Date.now()}`;
        const newItems = { ...treeItems };
        const parent = newItems[parentId];
        const newDepth = (parent?.data.depth ?? 0) + 1;

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
                groupName: "", // 시작 시 빈 이름으로 사용자 입력 유도
                parentId: parentId,
                sortNo: maxSortNo + 1,
                depth: newDepth,
                enabledTF: true,
                isNew: true
            },
            canMove: true,
            canRename: true
        };

        if (parent) {
            newItems[parentId] = {
                ...parent,
                children: [...(parent.children || []), tempId]
            };
        }

        setTreeItems(newItems);
        setRenamingItemId(tempId);
    }, [treeItems]);

    // 아이템 이름 변경 핸들러 (Lifting)
    const handleRenameItem = useCallback(
        (item: any, name: string): void => {
            const isNewItem = item.data.isNew === true;

            // 이름이 없거나 빈 칸만 있는 경우 처리
            if (!name || name.trim() === "") {
                if (isNewItem) {
                    // 새로 추가된 항목인데 이름을 안 적었으면 트리에서 삭제
                    handleRemoveItem(item.index as string);
                }
                setRenamingItemId(null);
                return;
            }

            const newItems = {
                ...treeItems,
                [item.index]: {
                    ...treeItems[item.index],
                    data: {
                        ...treeItems[item.index].data,
                        groupName: name
                    }
                }
            };
            setRenamingItemId(null);
            handleTreeChange(newItems);
        },
        [treeItems, handleTreeChange, handleRemoveItem]
    );

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
                onRenameItem={handleRenameItem}
                renamingItemId={renamingItemId}
                onStartRenaming={(id: any) => setRenamingItemId(id)}
                onStopRenaming={() => setRenamingItemId(null)}
            />
        </div>
    );
}
