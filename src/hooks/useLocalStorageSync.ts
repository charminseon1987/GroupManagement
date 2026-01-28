import { useCallback } from "react";
import { GroupTreeItemMap, GroupTreeChange, GroupTreeChanges, GROUP_ROOT_ID } from "../types/groupTree.types";

const STORAGE_KEY = "groupManagementTreeChanges";

/**
 * localStorage에 변경사항을 저장하는 훅
 */
export function useLocalStorageSync() {
    /**
     * 트리 변경사항을 localStorage에 저장
     */
    const saveChanges = useCallback((items: GroupTreeItemMap, previousItems: GroupTreeItemMap) => {
        const changes: GroupTreeChange[] = [];

        // 변경된 아이템 찾기
        Object.keys(items).forEach(itemId => {
            if (itemId === GROUP_ROOT_ID) {
                return; // 루트는 제외
            }

            const currentItem = items[itemId];
            const previousItem = previousItems[itemId];

            if (!currentItem) {
                return;
            }

            // 이전 아이템이 없거나, parentId, sortNo, depth가 변경된 경우
            if (!previousItem || 
                previousItem.data.parentId !== currentItem.data.parentId ||
                previousItem.data.sortNo !== currentItem.data.sortNo ||
                previousItem.data.depth !== currentItem.data.depth) {
                
                changes.push({
                    groupId: currentItem.data.id,
                    parentId: currentItem.data.parentId,
                    sortNo: currentItem.data.sortNo,
                    depth: currentItem.data.depth
                });
            }
        });

        if (changes.length === 0) {
            return; // 변경사항이 없으면 저장하지 않음
        }

        // localStorage에 저장
        const changesData: GroupTreeChanges = {
            changes,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(changesData));
        } catch (error) {
            console.error("Failed to save changes to localStorage:", error);
        }
    }, []);

    /**
     * localStorage에서 변경사항 읽기
     */
    const loadChanges = useCallback((): GroupTreeChanges | null => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) {
                return null;
            }
            return JSON.parse(data) as GroupTreeChanges;
        } catch (error) {
            console.error("Failed to load changes from localStorage:", error);
            return null;
        }
    }, []);

    /**
     * localStorage의 변경사항 삭제
     */
    const clearChanges = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error("Failed to clear changes from localStorage:", error);
        }
    }, []);

    return {
        saveChanges,
        loadChanges,
        clearChanges,
        storageKey: STORAGE_KEY
    };
}
