import React, { ReactElement, createElement, useState, useCallback, useMemo } from "react";
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
    const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>(() => {
        // 초기에 모든 폴더를 확장
        return Object.values(treeItems)
            .filter(item => item.isFolder && item.children && item.children.length > 0)
            .map(item => item.index);
    });
    const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([]);

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

            // 타겟 정보 결정
            let targetParentId: TreeItemIndex;
            let targetIndex: number;

            if (target.targetType === "root") {
                targetParentId = GROUP_ROOT_ID;
                const rootItem = newItems[GROUP_ROOT_ID];
                targetIndex = rootItem.children?.length || 0;
            } else if (target.targetType === "item") {
                targetParentId = target.targetItem;
                const targetItem = newItems[target.targetItem];
                targetIndex = targetItem.children?.length || 0;
            } else {
                // between-items
                targetParentId = target.parentItem;
                targetIndex = target.childIndex;
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
                    const newChildren = [...(newParent.children || [])];
                    const adjustedIndex = Math.min(targetIndex + offsetIndex, newChildren.length);
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
                />
            );
        },
        [onRemoveItem, onAddSubFolder]
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
