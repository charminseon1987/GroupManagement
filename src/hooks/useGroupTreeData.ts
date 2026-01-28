import { useMemo } from "react";
import { GroupTreeItemMap } from "../types/groupTree.types";
import { convertMendixEntitiesToTree, MendixGroupEntity } from "../utils/treeDataConverter";

/**
 * Mendix datasource에서 Group 데이터를 읽어 트리 형식으로 변환하는 훅
 */
export function useGroupTreeData(
    datasource: any[] | undefined
): GroupTreeItemMap {
    return useMemo(() => {
        if (!datasource || !Array.isArray(datasource)) {
            return {};
        }

        // Mendix 엔티티를 변환
        const entities: MendixGroupEntity[] = datasource.map((item: any) => {
            // Mendix 엔티티 속성 접근
            // Mendix에서는 속성을 직접 접근하거나 get() 메서드를 통해 접근할 수 있음
            const groupNameRaw =
                item.GroupName?.value ?? item.GroupName ?? (typeof item.get === "function" ? item.get("GroupName") : undefined);
            const groupName =
                typeof groupNameRaw === "string"
                    ? groupNameRaw
                    : groupNameRaw != null && typeof groupNameRaw === "object" && "value" in groupNameRaw && typeof (groupNameRaw as { value: unknown }).value === "string"
                      ? (groupNameRaw as { value: string }).value
                      : "";
            return {
                Groupld: item.Groupld?.value || item.id?.value || item.id,
                GroupName: groupName,
                ParentId: item.ParentId?.value || item.ParentId || null,
                SortNo: item.SortNo?.value !== undefined ? Number(item.SortNo?.value || item.SortNo) : 0,
                Depth: item.Depth?.value !== undefined ? Number(item.Depth?.value || item.Depth) : 0,
                Description: item.Description?.value || item.Description,
                EnableTF: item.EnableTF?.value !== undefined ? Boolean(item.EnableTF?.value || item.EnableTF) : true,
                id: item.id?.value || item.id
            };
        });

        return convertMendixEntitiesToTree(entities);
    }, [datasource]);
}
