import { TreeItem, TreeItemIndex } from "react-complex-tree";
import { GroupTreeItemData, GroupTreeItemMap, GROUP_ROOT_ID } from "../types/groupTree.types";

/**
 * Mendix 엔티티 데이터 타입
 * Mendix에서 전달되는 SyGroup 엔티티의 속성
 */
export interface MendixGroupEntity {
    /** Groupld 속성 */
    Groupld?: string;
    /** GroupName 속성 */
    GroupName?: string;
    /** ParentId 속성 */
    ParentId?: string | null;
    /** SortNo 속성 */
    SortNo?: number;
    /** Depth 속성 */
    Depth?: number;
    /** Description 속성 */
    Description?: string;
    /** EnableTF 속성 */
    EnableTF?: boolean;
    /** Mendix GUID */
    id?: string;
}

/**
 * Mendix 엔티티 리스트를 react-complex-tree 형식으로 변환
 */
export function convertMendixEntitiesToTree(
    entities: MendixGroupEntity[]
): GroupTreeItemMap {
    const itemMap: GroupTreeItemMap = {};
    
    // 루트 아이템 생성
    const rootChildren: TreeItemIndex[] = [];
    
    // 모든 엔티티를 TreeItem으로 변환
    entities.forEach(entity => {
        const groupId = entity.Groupld || entity.id || "";
        if (!groupId) {
            return; // ID가 없으면 스킵
        }

        const parentId = entity.ParentId || null;
        const sortNo = entity.SortNo ?? 0;
        const depth = entity.Depth ?? 0;
        const name = entity.GroupName || entity.Groupld || entity.id || "";
        const description = entity.Description;
        const enabled = entity.EnableTF ?? true;

        const itemData: GroupTreeItemData = {
            id: groupId,
            name,
            parentId,
            sortNo,
            depth,
            description,
            enabled
        };

        const item: TreeItem<GroupTreeItemData> = {
            index: groupId,
            data: itemData,
            children: [],
            isFolder: true, // Group은 모두 폴더
            canMove: enabled, // 활성화된 것만 이동 가능
            canRename: true
        };

        itemMap[groupId] = item;

        // 루트의 자식인 경우
        if (parentId === null || parentId === "") {
            rootChildren.push(groupId);
        }
    });

    // 부모-자식 관계 설정
    Object.values(itemMap).forEach(item => {
        const parentId = item.data.parentId;
        
        if (parentId && itemMap[parentId]) {
            // 부모가 있는 경우
            const parent = itemMap[parentId];
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(item.index);
        }
    });

    // 정렬: SortNo 기준으로 정렬
    Object.values(itemMap).forEach(item => {
        if (item.children && item.children.length > 0) {
            item.children.sort((a, b) => {
                const itemA = itemMap[a];
                const itemB = itemMap[b];
                const sortNoA = itemA?.data.sortNo ?? 0;
                const sortNoB = itemB?.data.sortNo ?? 0;
                return sortNoA - sortNoB;
            });
        }
    });

    // 루트 아이템 생성
    const rootItem: TreeItem<GroupTreeItemData> = {
        index: GROUP_ROOT_ID,
        data: {
            id: GROUP_ROOT_ID as string,
            name: "Root",
            parentId: null,
            sortNo: 0,
            depth: -1,
            enabled: true
        },
        children: rootChildren.sort((a, b) => {
            const itemA = itemMap[a];
            const itemB = itemMap[b];
            const sortNoA = itemA?.data.sortNo ?? 0;
            const sortNoB = itemB?.data.sortNo ?? 0;
            return sortNoA - sortNoB;
        }),
        isFolder: true,
        canMove: false,
        canRename: false
    };

    itemMap[GROUP_ROOT_ID] = rootItem;

    return itemMap;
}

/**
 * 트리 구조에서 깊이 계산
 */
export function calculateDepth(
    items: GroupTreeItemMap,
    itemId: TreeItemIndex,
    rootId: TreeItemIndex = GROUP_ROOT_ID
): number {
    const item = items[itemId];
    if (!item || itemId === rootId) {
        return 0;
    }

    const parentId = item.data.parentId;
    if (!parentId || parentId === rootId) {
        return 1;
    }

    return 1 + calculateDepth(items, parentId, rootId);
}
