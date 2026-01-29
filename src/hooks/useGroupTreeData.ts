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
            // Mendix 엔티티 속성 접근 헬퍼 함수
            const getAttribute = (attrName: string): string | undefined => {
                if (typeof item.get === "function") {
                    const value = item.get(attrName);
                    if (typeof value === "string") return value;
                    if (value != null && typeof value === "object" && "value" in value) {
                        const val = (value as { value: unknown }).value;
                        return typeof val === "string" ? val : String(val);
                    }
                    return value != null ? String(value) : undefined;
                }
                // get() 메서드가 없으면 직접 속성 접근
                const directValue = item[attrName];
                if (directValue != null) {
                    if (typeof directValue === "string") return directValue;
                    if (typeof directValue === "object" && "value" in directValue) {
                        const val = (directValue as { value: unknown }).value;
                        return typeof val === "string" ? val : String(val);
                    }
                    return String(directValue);
                }
                return undefined;
            };

            const getNumberAttribute = (attrName: string, defaultValue: number = 0): number => {
                const value = getAttribute(attrName);
                if (value === undefined) return defaultValue;
                const num = Number(value);
                return isNaN(num) ? defaultValue : num;
            };

            const getBooleanAttribute = (attrName: string, defaultValue: boolean = true): boolean => {
                const value = getAttribute(attrName);
                if (value === undefined) return defaultValue;
                if (typeof value === "boolean") return value;
                if (typeof value === "string") {
                    return value.toLowerCase() === "true" || value === "1";
                }
                return Boolean(value);
            };

            // GroupName을 우선적으로 가져오기 (Mendix의 GroupName 속성)
            // 데이터베이스 컬럼명은 groupname (소문자)이므로 다양한 변형 시도
            // Mendix ListValue 아이템에서 속성 접근 방식:
            // 1. item.get("GroupName") 또는 item.get("groupname") - Mendix get 메서드
            // 2. item.GroupName 또는 item.groupname - 직접 속성 접근
            // 3. item.GroupName?.value 또는 item.groupname?.value - value 속성을 가진 객체
            let groupNameRaw: string | undefined;
            
            // 시도할 속성 이름 목록 (대소문자 변형 포함)
            const possibleAttributeNames = [
                "GroupName",      // 표준 대문자
                "groupname",      // 소문자 (데이터베이스 컬럼명)
                "groupName",      // camelCase
                "Group_Name",     // 스네이크 케이스 대문자
                "group_name",     // 스네이크 케이스 소문자
                "GROUPNAME",      // 대문자 전체
                "Name",           // 짧은 이름
                "name"            // 짧은 이름 소문자
            ];
            
            // 방법 1: get() 메서드 사용하여 모든 변형 시도
            if (typeof item.get === "function") {
                for (const attrName of possibleAttributeNames) {
                    if (groupNameRaw) break;
                    try {
                        const value = item.get(attrName);
                        if (value != null) {
                            if (typeof value === "string" && value.trim() !== "") {
                                groupNameRaw = value;
                                break;
                            } else if (typeof value === "object" && "value" in value) {
                                const val = (value as { value: unknown }).value;
                                if (typeof val === "string" && val.trim() !== "") {
                                    groupNameRaw = val;
                                    break;
                                } else if (val != null) {
                                    groupNameRaw = String(val);
                                    break;
                                }
                            } else if (value != null) {
                                groupNameRaw = String(value);
                                break;
                            }
                        }
                    } catch (e) {
                        // 다음 속성 이름 시도
                        continue;
                    }
                }
            }
            
            // 방법 2: 직접 속성 접근 (모든 변형 시도)
            if (!groupNameRaw) {
                for (const attrName of possibleAttributeNames) {
                    if (groupNameRaw) break;
                    const directValue = item[attrName];
                    if (directValue != null) {
                        if (typeof directValue === "string" && directValue.trim() !== "") {
                            groupNameRaw = directValue;
                            break;
                        } else if (typeof directValue === "object" && "value" in directValue) {
                            const val = (directValue as { value: unknown }).value;
                            if (typeof val === "string" && val.trim() !== "") {
                                groupNameRaw = val;
                                break;
                            } else if (val != null) {
                                groupNameRaw = String(val);
                                break;
                            }
                        } else {
                            groupNameRaw = String(directValue);
                            break;
                        }
                    }
                }
            }
            
            // 방법 3: getAttribute 헬퍼 함수 사용 (모든 변형 시도)
            if (!groupNameRaw) {
                for (const attrName of possibleAttributeNames) {
                    if (groupNameRaw) break;
                    groupNameRaw = getAttribute(attrName);
                    if (groupNameRaw && groupNameRaw.trim() !== "") {
                        break;
                    }
                }
            }
            
            // GroupName이 실제 값인지 확인 (빈 문자열이 아닌지)
            const groupName = (groupNameRaw && groupNameRaw.trim() !== "") 
                ? groupNameRaw 
                : (getAttribute("Groupld") || getAttribute("id") || "");
            
            // 디버깅: GroupName이 제대로 읽히지 않으면 콘솔에 경고 및 상세 정보
            if (!groupNameRaw) {
                // 사용 가능한 모든 속성 이름 확인
                const availableKeys = Object.keys(item).filter(k => 
                    !k.startsWith("_") && 
                    typeof item[k] !== "function" &&
                    k.toLowerCase().includes("name") || k.toLowerCase().includes("group")
                );
                
                // get() 메서드로 가능한 속성 이름들 시도 (더 많은 변형 포함)
                const possibleNames: string[] = [];
                if (typeof item.get === "function") {
                    const testNames = ["GroupName", "groupname", "groupName", "Group_Name", "group_name", "GROUPNAME", "Name", "name"];
                    testNames.forEach(name => {
                        try {
                            const val = item.get(name);
                            if (val !== undefined && val !== null) {
                                const valStr = typeof val === "object" && "value" in val ? String(val.value) : String(val);
                                possibleNames.push(`${name}: ${valStr}`);
                            }
                        } catch (e) {
                            // 무시
                        }
                    });
                }
                
                console.warn("SyGroup 엔티티의 GroupName 속성을 찾을 수 없습니다.", {
                    itemId: item.id || item.Groupld || "unknown",
                    availableKeys: Object.keys(item).filter(k => !k.startsWith("_") && typeof item[k] !== "function"),
                    nameRelatedKeys: availableKeys,
                    possibleNames: possibleNames,
                    GroupNameDirect: item.GroupName,
                    hasGetMethod: typeof item.get === "function",
                    itemType: typeof item,
                    itemConstructor: item.constructor?.name
                });
            }
            
            return {
                Groupld: getAttribute("Groupld") || getAttribute("id") || "",
                GroupName: groupName,
                ParentId: getAttribute("ParentId") || null,
                SortNo: getNumberAttribute("SortNo", 0),
                Depth: getNumberAttribute("Depth", 0),
                Description: getAttribute("Description"),
                EnableTF: getBooleanAttribute("EnableTF", true),
                id: getAttribute("id") || ""
            };
        });

        return convertMendixEntitiesToTree(entities);
    }, [datasource]);
}
