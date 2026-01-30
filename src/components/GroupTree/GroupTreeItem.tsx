import { ReactElement, createElement, ReactNode, useState, useEffect, useRef } from "react";
import { TreeItem, TreeItemRenderContext, TreeItemIndex } from "react-complex-tree";
import classNames from "classnames";
import { GroupItemData } from "../../types/groupTree.types";
import {
    ChevronIcon,
    FolderIcon,
    DragHandleIcon
} from "./GroupTreeIcons";

interface GroupTreeItemProps {
    item: TreeItem<GroupItemData>;
    context: TreeItemRenderContext;
    children?: ReactNode;
    onRemove: (itemId: TreeItemIndex) => void;
    onAddSubFolder?: (parentId: TreeItemIndex) => void;
    onRename?: (item: TreeItem<GroupItemData>, name: string) => void;
    isRenaming?: boolean;
    onStartRenaming?: () => void;
    onStopRenaming?: () => void;
}

/**
 * Group 트리 아이템 커스텀 렌더러
 */
export function GroupTreeItemRenderer({
    item,
    context,
    children,
    onRemove,
    onAddSubFolder,
    onRename,
    isRenaming,
    onStartRenaming,
    onStopRenaming
}: GroupTreeItemProps): ReactElement {
    const [tempName, setTempName] = useState(item.data.groupName);
    const inputRef = useRef<HTMLInputElement>(null);

    const isFolder = item.isFolder ?? true;
    const hasChildren = item.children && item.children.length > 0;

    const depth = item.data.depth ?? 1;
    const visualDepth = Math.max(0, depth - 1);

    // 이름 변경 상태 돌입 시 임시 이름 초기화 및 포커스
    useEffect(() => {
        if (isRenaming) {
            setTempName(item.data.groupName);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isRenaming, item.data.groupName]);

    const handleRenameSubmit = () => {
        if (onRename) {
            onRename(item, tempName);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleRenameSubmit();
        } else if (e.key === "Escape") {
            if (onStopRenaming) onStopRenaming();
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
                "is-disabled": !item.data.enabledTF,
                [`depth-${visualDepth}`]: true
            })}
            data-rct-item-id={item.index}
        >
            <div
                {...context.itemContainerWithoutChildrenProps}
                {...context.interactiveElementProps}
                className={classNames("group-tree-item", {
                    "is-folder": isFolder,
                    "is-expanded": context.isExpanded,
                    "is-selected": context.isSelected,
                    "is-focused": context.isFocused,
                    "is-dragging-over": context.isDraggingOver,
                    "is-disabled": !item.data.enabledTF,
                    [`depth-${visualDepth}`]: true
                })}
                style={{ cursor: item.data.enabledTF === false ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                    context.focusItem();
                }}
            >
                <div className="group-tree-drag-handle">
                    <DragHandleIcon size={14} />
                </div>

                <div className="group-tree-item-content">
                    <div className="group-tree-item-info">
                        {isFolder && hasChildren && (
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

                        {isFolder && !hasChildren && (
                            <div style={{ width: 18, height: 18 }} />
                        )}

                        {isFolder && (
                            <FolderIcon isOpen={context.isExpanded && hasChildren} size={18} />
                        )}

                        {isRenaming ? (
                            <input
                                ref={inputRef}
                                className="group-tree-rename-input"
                                value={tempName}
                                onChange={e => setTempName(e.target.value)}
                                onBlur={handleRenameSubmit}
                                onKeyDown={handleKeyDown}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                className="group-tree-item-name"
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (onStartRenaming) onStartRenaming();
                                }}
                            >
                                {item.data.groupName || "(이름 없음)"}
                            </span>
                        )}
                        {!item.data.enabledTF && <span className="group-tree-item-disabled-badge">(비활성)</span>}
                    </div>
                </div>

                <div className="group-tree-item-actions">
                    {onAddSubFolder && (
                        <button
                            className="group-tree-action-btn group-tree-add-btn"
                            onClick={e => {
                                e.stopPropagation();
                                onAddSubFolder(item.index);
                            }}
                            title="하위 그룹 추가"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    )}
                    {onRemove && (
                        <button
                            className="group-tree-action-btn group-tree-delete-btn"
                            onClick={e => {
                                e.stopPropagation();
                                onRemove(item.index);
                            }}
                            title="그룹 삭제"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {context.isExpanded && item.children && item.children.length > 0 && (
                <div className="group-tree-children">
                    {children}
                </div>
            )}
        </div>
    );
}
