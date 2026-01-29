import { useCallback } from "react";
import { GroupTreeItemMap, GroupTreeChange, GroupTreeChanges, GROUP_ROOT_ID } from "../types/groupTree.types";

const STORAGE_KEY = "groupManagementTreeChanges";

/**
 * 변경 목록 계산 (localStorage 저장 및 Mendix 액션 호출에 공통 사용)
 */
function computeChanges(items: GroupTreeItemMap, previousItems: GroupTreeItemMap): GroupTreeChange[] {
    const changes: GroupTreeChange[] = [];

    Object.keys(items).forEach(itemId => {
        if (itemId === GROUP_ROOT_ID) return;

        const currentItem = items[itemId];
        const previousItem = previousItems[itemId];

        if (!currentItem) return;

        if (
            !previousItem ||
            previousItem.data.parentId !== currentItem.data.parentId ||
            previousItem.data.sortNo !== currentItem.data.sortNo ||
            previousItem.data.depth !== currentItem.data.depth
        ) {
            changes.push({
                groupId: currentItem.data.id,
                parentId: currentItem.data.parentId,
                sortNo: currentItem.data.sortNo,
                depth: currentItem.data.depth
            });
        }
    });

    return changes;
}

/**
 * localStorage에 변경사항을 저장하는 훅
 */
export function useLocalStorageSync() {
    /**
     * 변경 목록 반환 (Mendix 액션 호출 등에 사용)
     */
    const getChangesList = useCallback(
        (items: GroupTreeItemMap, previousItems: GroupTreeItemMap): GroupTreeChange[] => {
            return computeChanges(items, previousItems);
        },
        []
    );

    /**
     * 트리 변경사항을 localStorage에 저장
     */
    const saveChanges = useCallback((items: GroupTreeItemMap, previousItems: GroupTreeItemMap) => {
        const changes = computeChanges(items, previousItems);
        if (changes.length === 0) return;

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
        getChangesList,
        loadChanges,
        clearChanges,
        storageKey: STORAGE_KEY
    };
}
