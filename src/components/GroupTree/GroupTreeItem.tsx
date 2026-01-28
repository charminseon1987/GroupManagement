import { ReactElement, createElement, ReactNode } from "react";
import { TreeItem, TreeItemRenderContext, TreeItemIndex } from "react-complex-tree";
import classNames from "classnames";
import { GroupTreeItemData } from "../../types/groupTree.types";
import {
    ChevronIcon,
    FolderIcon,
    DragHandleIcon,
    DeleteIcon,
    AddIcon
} from "./GroupTreeIcons";

interface GroupTreeItemProps {
    item: TreeItem<GroupTreeItemData>;
    context: TreeItemRenderContext;
    children?: ReactNode;
    onRemove: (itemId: TreeItemIndex) => void;
    onAddSubFolder?: (parentId: TreeItemIndex) => void;
}

/**
 * Group 트리 아이템 커스텀 렌더러
 */
export function GroupTreeItemRenderer({
    item,
    context,
    children,
    onRemove,
    onAddSubFolder
}: GroupTreeItemProps): ReactElement {
    const isFolder = item.isFolder ?? true; // Group은 모두 폴더
    const hasChildren = item.children && item.children.length > 0;

    const handleRemoveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(item.index);
    };

    const handleAddSubFolderClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onAddSubFolder) {
            onAddSubFolder(item.index);
        }
    };

    return (
        <div
            {...context.itemContainerWithChildrenProps}
            className={classNames("group-tree-item-container", {
                "is-folder": isFolder,
                "is-expanded": context.isExpanded,
                "is-selected": context.isSelected,
                "is-focused": context.isFocused,
                "is-dragging-over": context.isDraggingOver,
                "is-disabled": !item.data.enabled
            })}
        >
            <div
                {...context.itemContainerWithoutChildrenProps}
                {...context.interactiveElementProps}
                className={classNames("group-tree-item", {
                    "is-folder": isFolder,
                    "is-expanded": context.isExpanded,
                    "is-selected": context.isSelected,
                    "is-focused": context.isFocused,
                    "is-dragging": context.isDraggingOver,
                    "is-disabled": !item.data.enabled
                })}
            >
                {/* 드래그 핸들 */}
                <div className="group-tree-drag-handle">
                    <DragHandleIcon size={14} />
                </div>

                {/* 확장/축소 화살표 (폴더만) */}
                {isFolder && (
                    <button
                        type="button"
                        className="group-tree-expand-btn"
                        onClick={e => {
                            e.stopPropagation();
                            if (context.isExpanded) {
                                context.collapseItem();
                            } else {
                                context.expandItem();
                            }
                        }}
                        aria-label={context.isExpanded ? "축소" : "확장"}
                    >
                        <ChevronIcon isExpanded={context.isExpanded} size={14} />
                    </button>
                )}

                {/* 아이콘 */}
                {isFolder && (
                    <FolderIcon isOpen={context.isExpanded && hasChildren} size={18} />
                )}

                {/* 이름 */}
                <span className="group-tree-item-name">{item.data.name}</span>

                {/* 액션 버튼들 */}
                <div className="group-tree-item-actions">
                    {/* 하위 폴더 추가 버튼 (폴더만) */}
                    {isFolder && onAddSubFolder && (
                        <button
                            type="button"
                            className="group-tree-action-btn group-tree-add-btn"
                            onClick={handleAddSubFolderClick}
                            aria-label="하위 폴더 추가"
                            title="하위 폴더 추가"
                        >
                            <AddIcon size={14} />
                        </button>
                    )}

                    {/* 삭제 버튼 */}
                    <button
                        type="button"
                        className="group-tree-action-btn group-tree-delete-btn"
                        onClick={handleRemoveClick}
                        aria-label="삭제"
                        title="삭제"
                    >
                        <DeleteIcon size={14} />
                    </button>
                </div>
            </div>

            {/* 자식 컨테이너 */}
            {context.isExpanded && item.children && item.children.length > 0 && (
                <div className="group-tree-children">
                    {children}
                </div>
            )}
        </div>
    );
}
