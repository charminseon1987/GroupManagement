import { ReactElement, createElement, useState, useCallback, useEffect } from "react";
import { GroupManagementContainerProps } from "../typings/GroupManagementProps";
import { GroupTreeContainer } from "./components/GroupTree/GroupTreeContainer";
import { useGroupTreeData } from "./hooks/useGroupTreeData";
import { useLocalStorageSync } from "./hooks/useLocalStorageSync";
import { GroupTreeItemMap } from "./types/groupTree.types";
import "./ui/GroupManagement.css";

export function GroupManagement({ groupDataSource }: GroupManagementContainerProps): ReactElement {
    // Mendix datasource에서 데이터를 트리 형식으로 변환
    const treeItems = useGroupTreeData(groupDataSource.items);
    
    // localStorage 동기화 훅
    const { saveChanges } = useLocalStorageSync();
    
    // 이전 트리 아이템 상태 저장 (변경사항 감지용)
    const [previousTreeItems, setPreviousTreeItems] = useState<GroupTreeItemMap>(treeItems);

    // 트리 변경 핸들러
    const handleTreeChange = useCallback((newItems: GroupTreeItemMap) => {
        // 변경사항을 localStorage에 저장
        saveChanges(newItems, previousTreeItems);
        setPreviousTreeItems(newItems);
    }, [saveChanges, previousTreeItems]);

    // 아이템 삭제 핸들러
    const handleRemoveItem = useCallback((itemId: string) => {
        // 실제 삭제는 Mendix에서 처리하도록 localStorage에 저장
        // 여기서는 트리에서만 제거
        const newItems = { ...treeItems };
        const item = newItems[itemId];
        
        if (item) {
            // 부모에서 제거
            const parentId = item.data.parentId || "__group_root__";
            const parent = newItems[parentId];
            if (parent && parent.children) {
                newItems[parentId] = {
                    ...parent,
                    children: parent.children.filter(id => id !== itemId)
                };
            }
            
            // 아이템 삭제
            delete newItems[itemId];
            
            handleTreeChange(newItems);
        }
    }, [treeItems, handleTreeChange]);

    // 하위 폴더 추가 핸들러
    const handleAddSubFolder = useCallback((parentId: string | null) => {
        // 새 그룹 추가는 Mendix에서 처리
        // 여기서는 트리에 임시 아이템 추가 (실제로는 Mendix에서 생성 후 리로드 필요)
        console.log("Add sub folder to:", parentId);
    }, []);

    // groupDataSource 변경 시 이전 상태 업데이트
    useEffect(() => {
        setPreviousTreeItems(treeItems);
    }, [groupDataSource]);

    if (!groupDataSource) {
        return (
            <div className="group-management-widget">
                <p>데이터 소스를 설정해주세요.</p>
            </div>
        );
    }

    return (
        <div className="group-management-widget">
            <GroupTreeContainer
                treeItems={treeItems}
                onTreeChange={handleTreeChange}
                onRemoveItem={handleRemoveItem}
                onAddSubFolder={handleAddSubFolder}
            />
        </div>
    );
}
