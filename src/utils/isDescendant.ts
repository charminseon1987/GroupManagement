import { TreeItemIndex } from "react-complex-tree";
import { GroupTreeItemMap } from "../types/groupTree.types";

/**
 * targetId가 ancestorId의 하위 항목인지 확인
 * 순환 참조 방지를 위해 사용
 */
export function isDescendant(
    items: GroupTreeItemMap,
    ancestorId: TreeItemIndex,
    targetId: TreeItemIndex
): boolean {
    if (ancestorId === targetId) {
        return false;
    }

    const targetItem = items[targetId];
    if (!targetItem) {
        return false;
    }

    let currentParentId: TreeItemIndex | null = targetItem.data.parentId;

    while (currentParentId !== null) {
        if (currentParentId === ancestorId) {
            return true;
        }

        const parentItem = items[currentParentId];
        if (!parentItem) {
            break;
        }

        currentParentId = parentItem.data.parentId as TreeItemIndex | null;
    }

    return false;
}
