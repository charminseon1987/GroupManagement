import { useMemo } from "react";
import { GroupTreeItemMap } from "../types/groupTree.types";
import { convertMendixEntitiesToTree, MendixGroupEntity } from "../utils/treeDataConverter";

/**
 * Mendix datasource에서 Group 데이터를 읽어 트리 형식으로 변환하는 훅
 */
import { ListAttributeValue } from "mendix";
import { Big } from "big.js";

/**
 * Mendix datasource에서 Group 데이터를 읽어 트리 형식으로 변환하는 훅
 */
export function useGroupTreeData(
    datasource: any[] | undefined,
    config?: {
        groupNameAttr?: ListAttributeValue<string>;
        parentIdAttr?: ListAttributeValue<string>;
        sortNoAttr?: ListAttributeValue<Big>;
        depthAttr?: ListAttributeValue<Big>;
        descriptionAttr?: ListAttributeValue<string>;
        enableAttr?: ListAttributeValue<boolean>;
        groupIdAttr?: ListAttributeValue<string | Big>;
    }
): GroupTreeItemMap {
    return useMemo(() => {
        if (!datasource || !Array.isArray(datasource)) {
            return {};
        }

        // Mendix 엔티티를 변환
        const entities: MendixGroupEntity[] = datasource.map((item: any) => {
            // Mendix ListAttributeValue에서 값 추출
            const getMendixAttrValue = (attr?: ListAttributeValue<any>): any | undefined => {
                if (!attr) return undefined;
                const attrValue = attr.get(item);
                return attrValue.value; // Mendix 9+ EditableValue
            };

            // Mendix 엔티티 속성 접근 헬퍼 함수
            const getAttributeValue = (attrName?: string): string | undefined => {
                if (!attrName) return undefined;

                // Mendix 객체의 get() 메서드 사용
                if (typeof item.get === "function") {
                    try {
                        const value = item.get(attrName);
                        if (value === undefined || value === null) return undefined;
                        if (typeof value === "string") return value;
                        // 객체 형태 (예: {value: ...}) 처리
                        if (typeof value === "object" && "value" in value) {
                            const val = (value as { value: unknown }).value;
                            return val != null ? String(val) : undefined;
                        }
                        return String(value);
                    } catch (e) {
                        // 속성이 없거나 오류 발생 시 무시하고 undefined 반환
                        return undefined;
                    }
                }

                // 직접 속성 접근
                const val = item[attrName];
                if (val != null) return String(val);

                return undefined;
            };



            // 1. Group Name
            let groupName = "";
            const explicitGroupName = getMendixAttrValue(config?.groupNameAttr);

            if (explicitGroupName) {
                groupName = explicitGroupName;
            } else {
                // Fallback: 기존 로직
                let groupNameRaw: string | undefined;
                const possibleAttributeNames = [
                    "groupname", "GroupName", "groupName", "Group_Name", "group_name", "GROUPNAME", "Name", "name"
                ];
                for (const attrName of possibleAttributeNames) {
                    if (groupNameRaw) break;
                    groupNameRaw = getAttributeValue(attrName);
                    if (groupNameRaw && groupNameRaw.trim() !== "") break;
                }

                if (groupNameRaw && groupNameRaw.trim() !== "") {
                    groupName = groupNameRaw;
                } else {
                    const idVal = getAttributeValue("Groupld") || getAttributeValue("GroupId") || item.id;
                    groupName = idVal || "(이름 없음)";
                }
            }

            // 2. Other Attributes
            const getAttrAnyCase = (names: string[]): string | undefined => {
                for (const name of names) {
                    const val = getAttributeValue(name);
                    if (val !== undefined) return val;
                }
                return undefined;
            };

            // GroupID
            const explicitGroupId = getMendixAttrValue(config?.groupIdAttr);
            let groupId = "";
            if (explicitGroupId) {
                groupId = String(explicitGroupId);
            } else {
                groupId = getAttrAnyCase(["Groupld", "GroupId", "groupid", "groupId"]) || item.id || "";
            }

            // ParentID
            const explicitParentId = getMendixAttrValue(config?.parentIdAttr);
            let parentId: string | null = null;
            if (explicitParentId !== undefined) { // null check needs care since it can be null
                parentId = explicitParentId;
            } else {
                parentId = getAttrAnyCase(["ParentId", "parentid", "parentId"]) || null;
            }

            // SortNo
            const explicitSortNo = getMendixAttrValue(config?.sortNoAttr);
            let sortNo = 0;
            if (explicitSortNo) {
                sortNo = Number(explicitSortNo);
            } else {
                sortNo = Number(getAttrAnyCase(["SortNo", "sortno", "sortNo"]) || "0");
            }

            // Depth
            const explicitDepth = getMendixAttrValue(config?.depthAttr);
            let depth = 0;
            if (explicitDepth) {
                depth = Number(explicitDepth);
            } else {
                depth = Number(getAttrAnyCase(["Depth", "depth"]) || "0");
            }

            // Description
            const explicitDesc = getMendixAttrValue(config?.descriptionAttr);
            const description = explicitDesc || getAttrAnyCase(["Description", "description"]);

            // Enabled
            const explicitEnabled = getMendixAttrValue(config?.enableAttr);
            let enabled = true;
            if (explicitEnabled !== undefined) {
                enabled = explicitEnabled;
            } else {
                const enabledVal = getAttrAnyCase(["EnableTF", "enabletf", "Enabled", "enabled"]);
                if (enabledVal !== undefined) {
                    if (enabledVal.toLowerCase() === "false" || enabledVal === "0") enabled = false;
                }
            }

            return {
                Groupld: groupId, // 호환성 유지
                GroupName: groupName,
                ParentId: parentId,
                SortNo: sortNo,
                Depth: depth,
                Description: description,
                EnableTF: enabled,
                id: item.id || ""
            };
        });

        return convertMendixEntitiesToTree(entities);
    }, [datasource, config]);
}
