import { ReactElement, createElement, ReactNode } from "react";
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
}

/**
 * Group 트리 아이템 커스텀 렌더러
 */
export function GroupTreeItemRenderer({
    item,
    context,
    children
}: GroupTreeItemProps): ReactElement {
    const isFolder = item.isFolder ?? true; // Group은 모두 폴더
    const hasChildren = item.children && item.children.length > 0;

    // 뎁스 레벨 계산
    // depth: 데이터베이스의 실제 depth 값 (1=루트 레벨, 2=1단계 하위, 3=2단계 하위...)
    // visualDepth: 화면에 표시할 들여쓰기 레벨 (0=루트, 1=1단계 하위, 2=2단계 하위...)
    const depth = item.data.depth ?? 1;
    const visualDepth = Math.max(0, depth - 1); // depth=1이면 visualDepth=0 (루트), depth=2이면 visualDepth=1 (1단계 하위)

    // 디버깅: 뎁스 정보 출력
    if (process.env.NODE_ENV === "development" && depth > 1) {
        console.log("Tree item depth:", {
            groupName: item.data.groupName,
            depth,
            visualDepth,
            parentId: item.data.parentId
        });
    }

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

            {/* 타이틀 바 */}
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
                    // 비활성화된 아이템 선택 방지 (옵션)
                    /*
                    if (item.data.enabledTF === false) {
                        return;
                    }
                    */
                    context.focusItem();
                }}
            >
                {/* 드래그 핸들 */}
                <div className="group-tree-drag-handle">
                    <DragHandleIcon size={14} />
                </div>

                {/* 확장/축소 화살표 (폴더이고 자식이 있는 경우만) */}
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
                        title={`하위 폴더 추가 (현재: ${item.data.groupName})`}
                        aria-label={context.isExpanded ? "축소" : "확장"}
                    >
                        <ChevronIcon isExpanded={context.isExpanded} size={14} />
                    </button>
                )}

                {/* 자식이 없는 폴더의 경우 빈 공간 유지 */}
                {isFolder && !hasChildren && (
                    <div style={{ width: 24, height: 24, marginRight: 4 }} />
                )}

                {/* 아이콘 */}
                {isFolder && (
                    <FolderIcon isOpen={context.isExpanded && hasChildren} size={18} />
                )}

                {/* 이름 */}
                <span className="group-tree-item-name">{item.data.groupName}</span>
                {!item.data.enabledTF && <span className="group-tree-item-disabled-badge">(비활성)</span>}
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
