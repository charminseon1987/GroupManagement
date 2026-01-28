import { TreeItemIndex } from "react-complex-tree";

/**
 * Group 트리 아이템 데이터 타입
 */
export interface GroupTreeItemData {
    /** 그룹 ID (Groupld) */
    id: string;
    /** 그룹 이름 (GroupName) */
    name: string;
    /** 부모 그룹 ID (ParentId) - null이면 루트 */
    parentId: string | null;
    /** 정렬 순서 (SortNo) */
    sortNo: number;
    /** 깊이 (Depth) */
    depth: number;
    /** 설명 (Description) */
    description?: string;
    /** 활성화 여부 (EnableTF) */
    enabled: boolean;
}

/**
 * Group 트리 아이템 맵
 * key: TreeItemIndex (string), value: TreeItem<GroupTreeItemData>
 */
export type GroupTreeItemMap = {
    [itemId: TreeItemIndex]: import("react-complex-tree").TreeItem<GroupTreeItemData>;
};

/**
 * 루트 아이템 ID
 */
export const GROUP_ROOT_ID: TreeItemIndex = "__group_root__";

/**
 * localStorage에 저장되는 변경사항 타입
 */
export interface GroupTreeChange {
    /** 그룹 ID */
    groupId: string;
    /** 새로운 부모 ID (null이면 루트) */
    parentId: string | null;
    /** 새로운 정렬 순서 */
    sortNo: number;
    /** 새로운 깊이 */
    depth: number;
}

/**
 * localStorage에 저장되는 전체 변경사항 타입
 */
export interface GroupTreeChanges {
    /** 변경사항 배열 */
    changes: GroupTreeChange[];
    /** 타임스탬프 */
    timestamp: string;
}
