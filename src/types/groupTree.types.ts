import { TreeItem, TreeItemIndex } from "react-complex-tree";

/**
 * Group 데이터 구조 (Mendix 엔티티 대응)
 */
export interface GroupItemData {
    // SyGroup Entity 속성
    groupId: string;
    groupName: string;
    description?: string;
    parentId: string | null;
    depth: number;
    sortNo: number;
    leftNo?: number;
    rightNo?: number;
    displayYn?: string;
    enabledTF: boolean;

    // Local-only flag for creation
    isNew?: boolean;

    // Mendix Object
    guid?: string;
}

/**
 * React Complex Tree용 Group Item
 */
export interface GroupTreeItem extends TreeItem<GroupItemData> {
    index: TreeItemIndex;
    isFolder: boolean;
    children?: TreeItemIndex[];
    data: GroupItemData;
    canMove: boolean;
    canRename: boolean;
}

/**
 * Group 트리 아이템 맵
 */
export type GroupTreeItemMap = Record<TreeItemIndex, GroupTreeItem>;

/**
 * 루트 아이템 ID
 */
export const GROUP_ROOT_ID: TreeItemIndex = "__group_root__";

/**
 * 변경사항 타입
 */
export interface GroupTreeChange {
    groupId: string;
    parentId: string | null;
    sortNo: number;
    depth: number;
    groupName?: string;
    type?: "create" | "update" | "delete" | "move";
}

export interface GroupTreeChanges {
    changes: GroupTreeChange[];
    timestamp: string;
}
