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
    GroupTreeItemData,
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
}

/**
 * react-complex-tree 기반 Group 트리 컨테이너
 */
export function GroupTreeContainer({
    treeItems,
    onTreeChange,
    onRemoveItem,
    onAddSubFolder
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
        (items: TreeItem<GroupTreeItemData>[]): boolean => {
            // 루트는 드래그 불가, 비활성화된 항목도 드래그 불가
            return items.every(
                item => item.index !== GROUP_ROOT_ID && 
                item.canMove !== false && 
                item.data.enabled
            );
        },
        []
    );

    // 드롭 가능 여부 핸들러
    const canDropAtHandler = useCallback(
        (items: TreeItem<GroupTreeItemData>[], target: DraggingPosition): boolean => {
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

            // 자기 자신에게 드롭 불가
            if (draggedIds.includes(targetItemId)) return false;

            // 자신의 하위 항목에 드롭 불가 (순환 참조 방지)
            for (const draggedId of draggedIds) {
                if (isDescendant(treeItems, draggedId, targetItemId)) return false;
            }

            // item 타입일 경우 폴더가 아니면 드롭 불가
            if (target.targetType === "item" && !targetItem.isFolder) {
                return false;
            }

            return true;
        },
        [treeItems]
    );

    // 드롭 핸들러
    const onDropHandler = useCallback(
        (items: TreeItem<GroupTreeItemData>[], target: DraggingPosition): void => {
            const newItems = { ...treeItems };
            const draggedIds = items.map(item => item.index);

            // 디버깅: 드롭 정보 로그
            console.log("Drop handler called:", {
                draggedItems: draggedIds,
                targetType: target.targetType,
                targetItem: target.targetType === "item" ? target.targetItem : undefined,
                parentItem: target.targetType === "between-items" ? target.parentItem : undefined,
                childIndex: target.targetType === "between-items" ? target.childIndex : undefined
            });

            // 타겟 정보 결정
            let targetParentId: TreeItemIndex;
            let targetIndex: number;

            if (target.targetType === "root") {
                targetParentId = GROUP_ROOT_ID;
                const rootItem = newItems[GROUP_ROOT_ID];
                targetIndex = rootItem.children?.length || 0;
                console.log("Dropping to root, targetIndex:", targetIndex);
            } else if (target.targetType === "item") {
                // 타겟 아이템이 폴더인지 확인
                const targetItemId = (target as any).targetItem;
                const targetItem = newItems[targetItemId];
                console.log("Dropping on item:", {
                    targetItemId: targetItemId,
                    isFolder: targetItem?.isFolder,
                    hasChildren: targetItem?.children?.length || 0
                });
                
                if (targetItem && targetItem.isFolder) {
                    // 폴더 위에 드롭: 해당 폴더의 children에 추가
                    targetParentId = targetItemId;
                    targetIndex = targetItem.children?.length || 0;
                    console.log("Dropping into folder:", targetParentId, "at index:", targetIndex);
                } else {
                    // 폴더가 아니면 드롭 불가 (이미 canDropAtHandler에서 체크하지만 안전장치)
                    console.warn("Target item is not a folder, cannot drop");
                    return;
                }
            } else {
                // between-items: 부모 아이템의 children 사이에 삽입
                const betweenTarget = target as any;
                targetParentId = betweenTarget.parentItem;
                targetIndex = betweenTarget.childIndex;
                console.log("Dropping between items, parent:", targetParentId, "at index:", targetIndex);
            }

            // 모든 드래그된 아이템에 대해 처리
            draggedIds.forEach((draggedId, offsetIndex) => {
                const draggedItem = newItems[draggedId];
                if (!draggedItem) return;

                // 이전 부모에서 제거
                const oldParentId = draggedItem.data.parentId ?? GROUP_ROOT_ID;
                const oldParent = newItems[oldParentId];
                if (oldParent && oldParent.children) {
                    const oldIndex = oldParent.children.indexOf(draggedId);
                    newItems[oldParentId] = {
                        ...oldParent,
                        children: oldParent.children.filter(id => id !== draggedId)
                    };

                    // 같은 부모 내에서 이동하고, 이전 위치가 새 위치보다 앞에 있었다면 인덱스 조정
                    if (oldParentId === targetParentId && oldIndex < targetIndex) {
                        targetIndex--;
                    }
                }

                // 새 부모에 추가
                const newParentId = targetParentId === GROUP_ROOT_ID ? null : String(targetParentId);
                const newParent = newItems[targetParentId];

                if (newParent) {
                    // 부모의 children 배열이 없으면 생성
                    if (!newParent.children) {
                        newParent.children = [];
                    }
                    const newChildren = [...newParent.children];
                    const adjustedIndex = Math.min(targetIndex + offsetIndex, newChildren.length);
                    
                    // 중복 방지: 이미 children에 있으면 제거 후 다시 추가
                    const existingIndex = newChildren.indexOf(draggedId);
                    if (existingIndex !== -1) {
                        newChildren.splice(existingIndex, 1);
                        // 인덱스 조정
                        if (existingIndex < adjustedIndex) {
                            targetIndex--;
                        }
                    }
                    
                    newChildren.splice(adjustedIndex, 0, draggedId);

                    newItems[targetParentId] = {
                        ...newParent,
                        children: newChildren
                    };
                }

                // 드래그된 아이템의 parentId 및 depth 업데이트
                const newDepth = targetParentId === GROUP_ROOT_ID 
                    ? 1 
                    : calculateDepth(newItems, targetParentId) + 1;

                newItems[draggedId] = {
                    ...draggedItem,
                    data: {
                        ...draggedItem.data,
                        parentId: newParentId,
                        depth: newDepth,
                        sortNo: targetIndex + offsetIndex
                    }
                };
                
                console.log("Updated item:", {
                    draggedId,
                    newParentId,
                    newDepth,
                    sortNo: targetIndex + offsetIndex,
                    newParentChildren: newItems[targetParentId]?.children
                });
            });

            console.log("Final tree structure:", {
                rootChildren: newItems[GROUP_ROOT_ID]?.children,
                updatedItems: draggedIds.map(id => ({
                    id,
                    parentId: newItems[id]?.data.parentId,
                    depth: newItems[id]?.data.depth
                }))
            });

            onTreeChange(newItems);
        },
        [treeItems, onTreeChange]
    );

    // 폴더 확장
    const handleExpandItem = useCallback((item: TreeItem<GroupTreeItemData>) => {
        setExpandedItems(prev => [...prev, item.index]);
    }, []);

    // 폴더 축소
    const handleCollapseItem = useCallback((item: TreeItem<GroupTreeItemData>) => {
        setExpandedItems(prev => prev.filter(id => id !== item.index));
    }, []);

    // 아이템 포커스
    const handleFocusItem = useCallback((item: TreeItem<GroupTreeItemData>) => {
        setFocusedItem(item.index);
    }, []);

    // 아이템 선택
    const handleSelectItems = useCallback((items: TreeItemIndex[]) => {
        setSelectedItems(items);
    }, []);

    // 아이템 이름 변경
    const handleRenameItem = useCallback(
        (item: TreeItem<GroupTreeItemData>, name: string): void => {
            const newItems = {
                ...treeItems,
                [item.index]: {
                    ...treeItems[item.index],
                    data: {
                        ...treeItems[item.index].data,
                        name
                    }
                }
            };
            onTreeChange(newItems);
        },
        [treeItems, onTreeChange]
    );

    // 아이템 렌더러
    const renderItem = useCallback(
        ({ item, context, children }: {
            item: TreeItem<GroupTreeItemData>;
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
                    treeItems={treeItems}
                />
            );
        },
        [onRemoveItem, onAddSubFolder, treeItems]
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
                getItemTitle={item => item.data.name}
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
                onRenameItem={handleRenameItem}
                canRename={true}
                canSearch={false}
                canSearchByStartingTyping={false}
                defaultInteractionMode={InteractionMode.ClickItemToExpand}
                renderItem={renderItem}
                renderItemTitle={({ item }) => (
                    <span className="group-tree-item-title">{item.data.name}</span>
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
