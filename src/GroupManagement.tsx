import { ReactElement, createElement, useState, useCallback, useEffect, useMemo, useRef } from "react";
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
        isClickedAttr,
        onTreeChange,
        groupSelection
    } = props;

    // Mendix action reference (to avoid stale closures in async functions)
    const onTreeChangeRef = useRef(onTreeChange);
    onTreeChangeRef.current = onTreeChange;

    // Mendix attribute configuration memoization
    const config = useMemo(() => ({
        groupNameAttr,
        parentIdAttr,
        sortNoAttr,
        depthAttr,
        descriptionAttr,
        enableAttr,
        groupIdAttr,
        isClickedAttr
    }), [
        groupNameAttr,
        parentIdAttr,
        sortNoAttr,
        depthAttr,
        descriptionAttr,
        enableAttr,
        enableAttr,
        groupIdAttr,
        isClickedAttr
    ]);

    // Mendix datasource에서 데이터를 트리 형식으로 변환 (베이스 트리)
    const baseTree = useGroupTreeData(groupDataSource?.items, config);

    const [treeItems, setTreeItems] = useState<GroupTreeItemMap>(baseTree);
    const [previousTreeItems, setPreviousTreeItems] = useState<GroupTreeItemMap>(baseTree);
    const [renamingItemId, setRenamingItemId] = useState<TreeItemIndex | null>(null);

    // View state lifted from GroupTreeContainer
    const [focusedItem, setFocusedItem] = useState<TreeItemIndex | undefined>();
    const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([]);

    // [FIX] Ensure all data is loaded (disable pagination limit)
    useEffect(() => {
        if (groupDataSource && groupDataSource.status === "available") {
            groupDataSource.setLimit(undefined);
        }
    }, [groupDataSource]);

    // localStorage 동기화 훅
    const { saveChanges, getChangesList } = useLocalStorageSync();

    // Mendix 데이터(베이스 트리)가 바뀌면 위젯 트리를 서버 기준으로 동기화
    useEffect(() => {
        setTreeItems(baseTree);
        setPreviousTreeItems(baseTree);

        // 초기 로드 시 IsClicked가 true인 항목을 찾아 포커스/선택
        const items = Object.values(baseTree);
        const clickedItem = items.find(item => item.data.isClicked);

        if (clickedItem) {
            console.log(`[Sync] Clicked item found in baseTree: ${clickedItem.index}. Updating focus/selection.`);
            setFocusedItem(clickedItem.index);
            setSelectedItems([clickedItem.index]);
        } else if (items.length > 0 && !focusedItem) {
            // 아무것도 선택되지 않았을 때의 초기화 로직 (필요 시)
        }
    }, [baseTree]);

    // 변경사항을 DB에 저장하는 함수 (분리)
    const commitChanges = useCallback(
        async (
            newItems: GroupTreeItemMap,
            prevItems: GroupTreeItemMap,
            changes: GroupTreeChange[]
        ) => {
            setTreeItems(newItems);
            setPreviousTreeItems(newItems);
            saveChanges(newItems, prevItems);

            // [REMOVED] Execute microflow immediately (Moved to after commit to ensure DB sync)
            /*
            const action = onTreeChangeRef.current;
            if (action && !action.isExecuting) {
                const changesJson = JSON.stringify(changes);
                console.log(`[Commit] Triggering onTreeChange immediately with JSON:`, changesJson);
                action.execute({ changesJson });
            } else if (action?.isExecuting) {
                console.warn(`[Commit] onTreeChange was skipped because it is already executing.`);
            }
            */

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
                                    const setAttr = (search: string, value: any, attrProp?: any) => {
                                        // 1. 프로퍼티 설정값에서 속성명 추출 시도 (가장 정확)
                                        let exactName: string | undefined;
                                        if (attrProp && (attrProp as any).id) {
                                            const idStr = String((attrProp as any).id);
                                            exactName = idStr.includes('.') ? idStr.split('.').pop() : idStr;
                                        }

                                        // 2. 검색어로 찾기 (대소문자 무시)
                                        const exact = attrs.find((a: string) =>
                                            (exactName && a.toLowerCase() === exactName.toLowerCase()) ||
                                            (a.toLowerCase() === search.toLowerCase())
                                        );

                                        if (exact) {
                                            console.log(`[Commit] Setting ${exact} = ${value} for ${change.groupId}`);
                                            mxobj.set(exact, value);
                                            return true;
                                        }
                                        console.warn(`[Commit] Attribute "${search}" (Detected: ${exactName}) not found on object ${mxobj.getEntity()}`);
                                        return false;
                                    };

                                    setAttr("ParentId", change.parentId, parentIdAttr);
                                    setAttr("SortNo", new Big(change.sortNo), sortNoAttr);
                                    setAttr("Depth", new Big(change.depth), depthAttr);
                                    if (change.groupName !== undefined) {
                                        setAttr("GroupName", change.groupName, groupNameAttr);
                                    }

                                    // 신규 생성 시 기본값 또는 특정 필드 설정
                                    if (change.type === "create") {
                                        setAttr("EnableTF", true, enableAttr);
                                        // GroupId가 필요한 경우 설정
                                        if (change.groupId && !change.groupId.startsWith("new_folder_")) {
                                            setAttr("GroupId", change.groupId, groupIdAttr);
                                        }
                                    } else if (change.enabledTF !== undefined) {
                                        setAttr("EnableTF", change.enabledTF, enableAttr);
                                    }

                                    if (change.isClicked !== undefined) {
                                        setAttr("IsClicked", change.isClicked, isClickedAttr);
                                    }

                                    console.log(`[Commit] Prepared object for ${change.groupId} (Type: ${change.type})`);
                                    resolve(mxobj);
                                } catch (error) {
                                    console.error(`[Commit] Failed to set values for ${change.groupId}:`, error);
                                    resolve(null);
                                }
                            };

                            if (change.type === "create") {
                                // 엔티티 명칭 찾기 (데이터가 없을 때를 대비한 강화된 로직)
                                let entityName: string | undefined;

                                // 1. 기존 아이템에서 가져오기 (Symbol 기반 접근 포함)
                                if (groupDataSource.items && groupDataSource.items.length > 0) {
                                    const firstItem = groupDataSource.items[0];

                                    // 1-1. 공개 API 시도 (Pluggable Widgets 표준)
                                    entityName = (firstItem as any).entity || (firstItem as any).getEntity?.();

                                    // 1-2. Symbols 확인 (User Log 기반: Symbol(mxObject) 대응)
                                    if (!entityName) {
                                        try {
                                            const symbols = Object.getOwnPropertySymbols(firstItem);
                                            for (const sym of symbols) {
                                                if (sym.toString().toLowerCase().includes("mxobject")) {
                                                    const mxObj = (firstItem as any)[sym];
                                                    entityName = mxObj?.getEntity?.() || mxObj?.entity;
                                                    if (entityName) break;
                                                }
                                            }
                                        } catch (e) {
                                            console.warn("[Commit] Symbol access failed", e);
                                        }
                                    }
                                }

                                // 2. Fallback: 속성 정보에서 추론 (Mendix 내부 API 활용)
                                if (!entityName) {
                                    const attr = groupNameAttr || parentIdAttr || sortNoAttr || depthAttr;
                                    if (attr) {
                                        // @ts-ignore - internal property access
                                        entityName = (attr as any)._entity?.entityName ||
                                            (attr as any).entity?.entityName ||
                                            (attr as any).container?.entity?.entityName ||
                                            (attr as any)._container?.entity?.entityName;

                                        // 2-1. ID에서 추출 시도 (Entity.Attribute 포맷인 경우)
                                        if (!entityName && (attr as any).id) {
                                            const idStr = String((attr as any).id);
                                            if (idStr.includes('.')) {
                                                entityName = idStr.split('.')[0];
                                            }
                                        }
                                    }
                                }

                                // 3. Fallback: 데이터소스 자체에서 추론
                                if (!entityName && groupDataSource) {
                                    // @ts-ignore
                                    entityName = (groupDataSource as any).entity ||
                                        (groupDataSource as any)._entityName ||
                                        (groupDataSource as any).sourceEntity ||
                                        (groupDataSource as any)._guid?.split('/')[0];
                                }

                                if (entityName) {
                                    console.log(`[Commit] Final detected entity name: ${entityName}`);
                                    mx.data.create({
                                        entity: entityName,
                                        callback: modifyObject,
                                        error: (err: any) => {
                                            console.error(`[Commit] Creation failed for entity ${entityName}:`, err);
                                            resolve(null);
                                        }
                                    });
                                } else {
                                    console.error("[Commit] Could not determine entity name for creation.");
                                    // 최후의 수단: 브라우저 캐시나 전역 상태 어딘가에 있을 수 있는 정보 출력
                                    console.warn("[Debug] Full groupDataSource object structure:", groupDataSource);
                                    resolve(null);
                                }
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
                                    // 클라이언트 측 업데이트 알림 (다른 위젯 UI 갱신 도움)
                                    validObjects.forEach(obj => {
                                        mx.data.update({ guid: obj.getGuid() });
                                    });
                                    resolveCommit();
                                },
                                error: (error: any) => {
                                    console.error("Failed to commit changes:", error);
                                    rejectCommit(error);
                                }
                            });
                        });

                        // 트리 새로고침
                        console.log("[Commit] Commits finished. Requesting datasource reload and UI refresh.");

                        // 1. 데이터 소스 리로드
                        if (groupDataSource.reload) {
                            groupDataSource.reload();
                        }

                        // [NEW] Execute microflow AFTER commit to ensure Mendix refresh sees new data
                        const action = onTreeChangeRef.current;
                        if (action && !action.isExecuting) {
                            const changesJson = JSON.stringify(changes);
                            console.log(`[Commit] Triggering onTreeChange AFTER commit with JSON:`, changesJson);
                            action.execute({ changesJson });
                        } else if (action?.isExecuting) {
                            console.warn(`[Commit] onTreeChange (Post-Commit) was skipped because it is already executing.`);
                        }

                        // 2. 전체 페이지 새로고침 알림 (필요한 경우)
                        const mxui = (window as any).mx?.ui;
                        if (mxui && typeof mxui.reload === "function") {
                            console.log("[Commit] Triggering full UI reload to ensure page rendering.");
                            mxui.reload();
                        } else {
                            console.warn("[Commit] mx.ui.reload is not available. UI might not refresh completely.");
                        }
                    }
                } catch (error) {
                    console.error("Error during commit process:", error);
                }
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

        // 이름 변경 시작 시 Mendix에 isClicked = true 반영
        const item = newItems[tempId];
        if (item) {
            console.log(`[Rename] Starting rename for new item: ${tempId}. Setting isClicked = true.`);
            commitChanges(newItems, treeItems, [{
                groupId: tempId,
                parentId: parentId,
                sortNo: maxSortNo + 1,
                depth: newDepth,
                isClicked: true,
                type: "create"
            }]);
        }

        setRenamingItemId(tempId);
    }, [treeItems, commitChanges]);

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
            const changes = getChangesList(newItems, treeItems);

            // 이름 변경이 완료되면 isClicked = false로 되돌림
            const changesWithClickedOff = changes.map((c: any) => ({
                ...c,
                isClicked: false
            }));

            console.log(`[Rename] Finished renaming item: ${item.index}. New name: ${name}. Setting isClicked = false. Changes count: ${changes.length}`);
            commitChanges(newItems, treeItems, changesWithClickedOff);
        },
        [treeItems, handleTreeChange, handleRemoveItem, commitChanges]
    );

    // 이름 변경 시작 핸들러
    const handleStartRenaming = useCallback((itemId: TreeItemIndex) => {
        console.log(`[Rename] handleStartRenaming called for: ${itemId}`);
        setRenamingItemId(itemId);

        // Mendix에 isClicked = true 반영 (배타적 설정 및 로컬 즉시 반영)
        const currentItems = treeItems;
        const newItems = { ...currentItems };
        const changes: GroupTreeChange[] = [];

        // 1. 모든 항목의 로컬 IsClicked를 false로 (필요한 경우에만)
        Object.keys(newItems).forEach(id => {
            if (newItems[id].data.isClicked) {
                newItems[id] = {
                    ...newItems[id],
                    data: { ...newItems[id].data, isClicked: false }
                };
            }
        });

        // 2. 다른 모든 항목의 Mendix IsClicked를 false로 변경할 변경사항 수집
        Object.values(currentItems).forEach(item => {
            if (item.data.isClicked && item.index !== itemId && !item.data.isNew) {
                changes.push({
                    groupId: String(item.index),
                    parentId: item.data.parentId,
                    sortNo: item.data.sortNo,
                    depth: item.data.depth,
                    isClicked: false,
                    type: "update"
                });
            }
        });

        // 3. 현재 항목의 로컬 및 Mendix 상태를 true로
        const item = currentItems[itemId];
        if (item && !item.data.isNew) {
            newItems[itemId] = {
                ...item,
                data: { ...item.data, isClicked: true }
            };

            console.log(`[Rename] Setting isClicked = true for existing item: ${itemId}`);
            changes.push({
                groupId: String(itemId),
                parentId: item.data.parentId,
                sortNo: item.data.sortNo,
                depth: item.data.depth,
                isClicked: true,
                type: "update"
            });
        }

        if (changes.length > 0) {
            commitChanges(newItems, currentItems, changes);
        } else {
            setTreeItems(newItems); // 변경사항이 없어도 로컬 UI 상태는 일관성 있게 업데이트
        }
    }, [treeItems, commitChanges]);

    // 아이템 포커스 핸들러 (IsClicked 속성 관리 포함)
    const handleFocusItem = useCallback((itemId: TreeItemIndex) => {
        if (itemId === focusedItem) return;

        setFocusedItem(itemId);
        setSelectedItems([itemId]);

        // Mendix에 isClicked 반영 (배타적 설정 및 로컬 즉시 반영)
        const currentItems = treeItems;
        const newItems = { ...currentItems };
        const changes: GroupTreeChange[] = [];

        // 1. 모든 항목의 로컬 IsClicked를 false로
        Object.keys(newItems).forEach(id => {
            if (newItems[id].data.isClicked) {
                newItems[id] = {
                    ...newItems[id],
                    data: { ...newItems[id].data, isClicked: false }
                };
            }
        });

        // 2. 기존에 Mendix에서 IsClicked가 true였던 항목들을 찾아 false 변경사항 수집
        Object.values(currentItems).forEach(item => {
            if (item.data.isClicked && item.index !== itemId && !item.data.isNew) {
                changes.push({
                    groupId: String(item.index),
                    parentId: item.data.parentId,
                    sortNo: item.data.sortNo,
                    depth: item.data.depth,
                    isClicked: false,
                    type: "update"
                });
            }
        });

        // 3. 현재 클릭한 항목을 로컬 및 Mendix 상태 true로
        const targetItem = currentItems[itemId];
        if (targetItem && !targetItem.data.isNew) {
            newItems[itemId] = {
                ...targetItem,
                data: { ...targetItem.data, isClicked: true }
            };

            if (!targetItem.data.isClicked) {
                changes.push({
                    groupId: String(itemId),
                    parentId: targetItem.data.parentId,
                    sortNo: targetItem.data.sortNo,
                    depth: targetItem.data.depth,
                    isClicked: true,
                    type: "update"
                });
            }
        }

        if (changes.length > 0) {
            console.log(`[Focus] Toggling isClicked for exclusive selection. Changes:`, changes);
            commitChanges(newItems, currentItems, changes);
        } else {
            setTreeItems(newItems); // 변경사항이 없어도 로컬 UI 상태는 업데이트
        }

        // [NEW] Sync with Mendix Selection (Listen to Widget)
        if (groupSelection && groupDataSource?.items) {
            const treeItem = treeItems[itemId];
            const mendixGuid = treeItem?.data?.id; // This is the GUID stored in data

            console.log(`[Selection] Attempting to select item. TreeId: ${itemId}, MendixGUID: ${mendixGuid}`);

            // Find the Mendix ObjectItem using the GUID
            let selectedObject = undefined;
            if (mendixGuid) {
                selectedObject = groupDataSource.items.find(item => item.id === mendixGuid);
            } else {
                // Fallback: try direct match if no data.id (unlikely)
                selectedObject = groupDataSource.items.find(item => item.id === itemId);
            }

            console.log(`[Selection] Found object:`, selectedObject ? "Yes" : "No", selectedObject ? selectedObject.id : "null");

            if (selectedObject) {
                if (groupSelection.setSelection) {
                    groupSelection.setSelection(selectedObject);
                }
            } else {
                console.warn(`[Selection] Could not find object for GUID: ${mendixGuid}. Available items:`, groupDataSource.items.length);
                // If nothing selected or not found, maybe clear selection?
                if (groupSelection.setSelection) {
                    groupSelection.setSelection(undefined);
                }
            }
        }

    }, [treeItems, focusedItem, commitChanges, groupDataSource, groupSelection]);

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
                onStartRenaming={handleStartRenaming}
                onStopRenaming={() => {
                    console.log(`[Rename] onStopRenaming called. Setting isClicked = false for: ${renamingItemId}`);
                    if (renamingItemId && treeItems[renamingItemId]) {
                        const item = treeItems[renamingItemId];
                        commitChanges(treeItems, treeItems, [{
                            groupId: String(renamingItemId),
                            parentId: item.data.parentId,
                            sortNo: item.data.sortNo,
                            depth: item.data.depth,
                            isClicked: false,
                            type: "update"
                        }]);
                    }
                    setRenamingItemId(null);
                }}
                focusedItem={focusedItem}
                selectedItems={selectedItems}
                onFocusItem={handleFocusItem}
                onSelectItems={setSelectedItems}
            />
        </div>
    );
}
