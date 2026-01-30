import React, { ReactElement, createElement, useState, useCallback, useMemo, useEffect } from "react";
import {
    ControlledTreeEnvironment,
    Tree,
    TreeItem,
    TreeItemIndex,
    TreeItemRenderContext,
    DraggingPosition,
    InteractionMode
} from "react-complex-tree";
import classNames from "classnames";
import {
    GroupTreeItemMap,
    GroupItemData,
    GROUP_ROOT_ID
} from "../../types/groupTree.types";
import { isDescendant } from "../../utils/isDescendant";
import { calculateDepth } from "../../utils/treeDataConverter";
import { GroupTreeItemRenderer } from "./GroupTreeItem";

interface GroupTreeContainerProps {
    treeItems: GroupTreeItemMap;
    onTreeChange: (newItems: GroupTreeItemMap) => void;
    onRemoveItem: (itemId: TreeItemIndex) => void;
    onAddSubFolder?: (parentId: TreeItemIndex | null) => void;
    onRenameItem: (item: TreeItem<GroupItemData>, name: string) => void;
    renamingItemId: TreeItemIndex | null;
    onStartRenaming: (itemId: TreeItemIndex) => void;
    onStopRenaming: () => void;
}

/**
 * react-complex-tree 기반 Group 트리 컨테이너
 */
export function GroupTreeContainer({
    treeItems,
    onTreeChange,
    onRemoveItem,
    onAddSubFolder,
    onRenameItem,
    renamingItemId,
    onStartRenaming,
    onStopRenaming
}: GroupTreeContainerProps): ReactElement {
    // View state
    const [focusedItem, setFocusedItem] = useState<TreeItemIndex | undefined>();
    const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>([]);
    const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([]);

    // treeItems가 변경될 때 자동으로 확장 상태 업데이트
    useEffect(() => {
        // 자식이 있는 모든 폴더를 확장
        const itemsToExpand = Object.values(treeItems)
            .filter(item => item.isFolder && item.children && item.children.length > 0)
            .map(item => item.index);
        setExpandedItems(prev => {
            // 기존 확장 상태와 새로 확장할 항목을 합침 (중복 제거)
            const combined = [...new Set([...prev, ...itemsToExpand])];
            return combined;
        });
    }, [treeItems]);

    // 드래그 가능 여부 핸들러
    const canDragHandler = useCallback(
        (items: TreeItem<GroupItemData>[]): boolean => {
            // 루트는 드래그 불가, 비활성화된 항목도 드래그 불가
            return items.every(
                item => item.index !== GROUP_ROOT_ID &&
                    item.data.enabledTF !== false
            );
        },
        []
    );

    // 드롭 가능 여부 핸들러
    const canDropAtHandler = useCallback(
        (items: TreeItem<GroupItemData>[], target: DraggingPosition): boolean => {
            const draggedIds = items.map(item => item.index);

            // 타겟 아이템 결정
            let targetItemId: TreeItemIndex;

            if (target.targetType === "root") {
                targetItemId = GROUP_ROOT_ID;
            } else if (target.targetType === "item") {
                targetItemId = target.targetItem;
            } else {
                // between-items: 부모 아이템에 드롭
                targetItemId = target.parentItem;
            }

            const targetItem = treeItems[targetItemId];

            // 대상이 존재하지 않으면 드롭 불가
            if (!targetItem) return false;

            // 자기 자신이나 자신의 하위 항목에 드롭 불가 (순환 참조 방지)
            if (draggedIds.includes(targetItemId)) return false;
            for (const draggedId of draggedIds) {
                if (isDescendant(treeItems, draggedId, targetItemId)) return false;
            }

            return true;
        },
        [treeItems]
    );

    // 드롭 핸들러
    const onDropHandler = useCallback(
        (items: TreeItem<GroupItemData>[], target: DraggingPosition): void => {
            const newItems = { ...treeItems };
            const draggedIds = items.map(item => item.index);

            // 1. 타겟 부모 및 삽입 인덱스 결정
            let targetParentId: TreeItemIndex;
            let targetIndex: number;

            if (target.targetType === "root") {
                targetParentId = GROUP_ROOT_ID;
                targetIndex = newItems[GROUP_ROOT_ID].children?.length || 0;
            } else if (target.targetType === "item") {
                targetParentId = target.targetItem;
                targetIndex = newItems[targetParentId].children?.length || 0;
            } else {
                targetParentId = target.parentItem;
                targetIndex = target.childIndex;
            }

            // 2. 소스 부모(들)에서 아이템 제거
            draggedIds.forEach(draggedId => {
                const draggedItem = newItems[draggedId];
                if (!draggedItem) return;

                const oldParentId = draggedItem.data.parentId ?? GROUP_ROOT_ID;
                const oldParent = newItems[oldParentId];
                if (oldParent && oldParent.children) {
                    const oldIndex = oldParent.children.indexOf(draggedId);

                    // 같은 부모 내에서 이동하고, 이전 위치가 새 위치보다 앞에 있었다면 인덱스 조정
                    if (oldParentId === targetParentId && oldIndex < targetIndex) {
                        targetIndex--;
                    }

                    newItems[oldParentId] = {
                        ...oldParent,
                        children: oldParent.children.filter(id => id !== draggedId)
                    };

                    // 소스 부모의 남은 자식들 SortNo 재정렬
                    newItems[oldParentId].children?.forEach((childId, idx) => {
                        const child = newItems[childId];
                        if (child) {
                            newItems[childId] = {
                                ...child,
                                data: { ...child.data, sortNo: idx }
                            };
                        }
                    });
                }
            });

            // 3. 타겟 부모의 children 배열 업데이트 및 SortNo 재정렬
            const targetParent = newItems[targetParentId];
            if (targetParent) {
                const currentChildren = [...(targetParent.children || [])];

                // 지정된 위치에 드래그된 아이템들 삽입
                currentChildren.splice(targetIndex, 0, ...draggedIds);

                // 타겟 부모의 모든 자식에 대해 SortNo 새로 할당 (0, 1, 2...)
                currentChildren.forEach((childId, idx) => {
                    const child = newItems[childId];
                    if (child) {
                        const isDragged = draggedIds.includes(childId);

                        // 드래그된 아이템인 경우 parentId와 depth도 같이 갱신
                        if (isDragged) {
                            const newParentId = targetParentId === GROUP_ROOT_ID ? null : String(targetParentId);
                            const newDepth = targetParentId === GROUP_ROOT_ID
                                ? 1
                                : calculateDepth(newItems, targetParentId) + 1;

                            newItems[childId] = {
                                ...child,
                                data: {
                                    ...child.data,
                                    parentId: newParentId,
                                    depth: newDepth,
                                    sortNo: idx
                                }
                            };

                            // 자식들의 depth도 재귀적으로 업데이트
                            const updateDescendantsDepth = (pid: TreeItemIndex, pDepth: number) => {
                                const parentItem = newItems[pid];
                                if (parentItem && parentItem.children) {
                                    parentItem.children.forEach(cid => {
                                        const cItem = newItems[cid];
                                        if (cItem) {
                                            const cDepth = pDepth + 1;
                                            newItems[cid] = {
                                                ...cItem,
                                                data: { ...cItem.data, depth: cDepth }
                                            };
                                            updateDescendantsDepth(cid, cDepth);
                                        }
                                    });
                                }
                            };
                            updateDescendantsDepth(childId, newDepth);
                        } else {
                            // 단순 순서 변경인 경우 sortNo만 업데이트
                            newItems[childId] = {
                                ...child,
                                data: { ...child.data, sortNo: idx }
                            };
                        }
                    }
                });

                newItems[targetParentId] = {
                    ...targetParent,
                    children: currentChildren
                };
            }

            onTreeChange(newItems);
        },
        [treeItems, onTreeChange]
    );

    // 폴더 확장
    const handleExpandItem = useCallback((item: TreeItem<GroupItemData>) => {
        setExpandedItems(prev => [...prev, item.index]);
    }, []);

    // 폴더 축소
    const handleCollapseItem = useCallback((item: TreeItem<GroupItemData>) => {
        setExpandedItems(prev => prev.filter(id => id !== item.index));
    }, []);

    // 아이템 포커스
    const handleFocusItem = useCallback((item: TreeItem<GroupItemData>) => {
        setFocusedItem(item.index);
    }, []);

    // 아이템 선택
    const handleSelectItems = useCallback((items: TreeItemIndex[]) => {
        setSelectedItems(items);
    }, []);


    // 아이템 렌더러
    const renderItem = useCallback(
        ({ item, context, children }: {
            item: TreeItem<GroupItemData>;
            context: TreeItemRenderContext;
            children: React.ReactNode;
        }) => {
            return (
                <GroupTreeItemRenderer
                    item={item}
                    context={context}
                    children={children}
                    onRemove={onRemoveItem}
                    onAddSubFolder={onAddSubFolder}
                    onRename={onRenameItem}
                    isRenaming={renamingItemId === item.index}
                    onStartRenaming={() => onStartRenaming(item.index)}
                    onStopRenaming={onStopRenaming}
                />
            );
        },
        [onRemoveItem, onAddSubFolder, treeItems, renamingItemId, onRenameItem, onStartRenaming, onStopRenaming]
    );

    // viewState 메모이제이션
    const viewState = useMemo(
        () => ({
            "group-tree": {
                focusedItem,
                expandedItems,
                selectedItems
            }
        }),
        [focusedItem, expandedItems, selectedItems]
    );

    return (
        <div className="group-tree-container">
            <ControlledTreeEnvironment
                items={treeItems}
                getItemTitle={item => item.data.groupName}
                viewState={viewState}
                canDragAndDrop={true}
                canDropOnFolder={true}
                canReorderItems={true}
                canDrag={canDragHandler}
                canDropAt={canDropAtHandler}
                onDrop={onDropHandler}
                onExpandItem={handleExpandItem}
                onCollapseItem={handleCollapseItem}
                onFocusItem={handleFocusItem}
                onSelectItems={handleSelectItems}
                onRenameItem={onRenameItem}
                canRename={true}
                canSearch={false}
                canSearchByStartingTyping={false}
                defaultInteractionMode={InteractionMode.ClickItemToExpand}
                renderItem={renderItem}
                renderItemTitle={({ item }) => (
                    <span className="group-tree-item-title">{item.data.groupName}</span>
                )}
                renderItemArrow={() => null}
                renderDragBetweenLine={({ draggingPosition, lineProps }) => (
                    <div
                        {...lineProps}
                        className={classNames("group-tree-drop-line", {
                            "drop-line-top": draggingPosition.targetType === "between-items"
                        })}
                    />
                )}
            >
                <Tree
                    treeId="group-tree"
                    rootItem={GROUP_ROOT_ID as string}
                    treeLabel="그룹 트리"
                />
            </ControlledTreeEnvironment>
        </div>
    );
}
