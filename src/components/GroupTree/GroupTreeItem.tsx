import { ReactElement, createElement, ReactNode } from "react";
import { TreeItem, TreeItemRenderContext, TreeItemIndex } from "react-complex-tree";
import classNames from "classnames";
import { GroupTreeItemData } from "../../types/groupTree.types";
import {
    ChevronIcon,
    FolderIcon,
    DragHandleIcon
} from "./GroupTreeIcons";

interface GroupTreeItemProps {
    item: TreeItem<GroupTreeItemData>;
    context: TreeItemRenderContext;
    children?: ReactNode;
    onRemove: (itemId: TreeItemIndex) => void;
    onAddSubFolder?: (parentId: TreeItemIndex) => void;
    treeItems?: { [key: string]: TreeItem<GroupTreeItemData> };
}

/**
 * Group 트리 아이템 커스텀 렌더러
 */
export function GroupTreeItemRenderer({
    item,
    context,
    children,
    treeItems
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
            itemName: item.data.name,
            depth,
            visualDepth,
            parentId: item.data.parentId
        });
    }
    
    // 각 뎁스 레벨마다 연결선 렌더링
    const renderDepthLines = () => {
        // visualDepth가 0이면 루트 레벨이므로 연결선 불필요
        if (!treeItems || visualDepth === 0) return null;
        
        const lines: ReactElement[] = [];
        
        // 각 뎁스 레벨마다 세로선과 가로선 그리기
        // visualDepth=1이면 1개의 연결선, visualDepth=2이면 2개의 연결선...
        for (let i = 0; i < visualDepth; i++) {
            // 현재 레벨의 부모 찾기
            let currentParentId: string | null = item.data.parentId;
            
            // i번째 레벨의 부모까지 올라가기
            for (let d = depth; d > i + 1; d--) {
                if (currentParentId && treeItems[currentParentId]) {
                    currentParentId = treeItems[currentParentId].data.parentId;
                } else {
                    break;
                }
            }
            
            const parentId = currentParentId || "__group_root__";
            const parent = treeItems[parentId];
            
            // 형제가 있는지 확인 (같은 부모 아래에 더 많은 자식이 있는지)
            const hasSiblingAfter = parent && parent.children 
                ? parent.children.indexOf(item.index) < parent.children.length - 1
                : false;
            
            // 세로선 (각 레벨마다)
            // 위치: 각 레벨마다 20px씩 오른쪽으로 이동
            lines.push(
                createElement('div', {
                    key: `depth-line-vertical-${i}`,
                    className: classNames("group-tree-depth-line-vertical", {
                        "has-sibling-after": hasSiblingAfter
                    }),
                    style: {
                        left: `${i * 20 + 9}px`,
                        top: '0px'
                    }
                })
            );
            
            // 마지막 레벨에만 가로선 추가 (아이템으로 연결하는 L자형 선)
            if (i === visualDepth - 1) {
                lines.push(
                    createElement('div', {
                        key: `depth-line-horizontal-${i}`,
                        className: "group-tree-depth-line-horizontal",
                        style: {
                            left: `${i * 20}px`,
                            top: '18px',
                            width: '10px'
                        }
                    })
                );
            }
        }
        
        return lines.length > 0 ? createElement('div', { 
            style: { 
                position: 'absolute', 
                left: 0, 
                top: 0, 
                bottom: 0, 
                width: 0,
                pointerEvents: 'none',
                zIndex: 0
            } 
        }, ...lines) : null;
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
                "is-disabled": !item.data.enabled,
                [`depth-${visualDepth}`]: true
            })}
            style={{
                paddingLeft: visualDepth > 0 ? `${visualDepth * 20}px` : '0px'
            }}
        >
            {/* 뎁스 레벨 연결선 */}
            {renderDepthLines()}
            
            <div
                {...context.itemContainerWithoutChildrenProps}
                {...context.interactiveElementProps}
                className={classNames("group-tree-item", {
                    "is-folder": isFolder,
                    "is-expanded": context.isExpanded,
                    "is-selected": context.isSelected,
                    "is-focused": context.isFocused,
                    "is-dragging": context.isDraggingOver,
                    "is-disabled": !item.data.enabled,
                    [`depth-${visualDepth}`]: true
                })}
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
                <span className="group-tree-item-name">{item.data.name}</span>
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
