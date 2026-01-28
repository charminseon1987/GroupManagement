import { ReactElement, createElement } from "react";
import classNames from "classnames";

interface IconProps {
    className?: string;
    size?: number;
}

interface ChevronIconProps extends IconProps {
    isExpanded?: boolean;
}

interface FolderIconProps extends IconProps {
    isOpen?: boolean;
}

/**
 * 확장/축소 화살표 아이콘
 */
export function ChevronIcon({ isExpanded, className, size = 16 }: ChevronIconProps): ReactElement {
    return (
        <svg
            className={classNames("tree-chevron", className, { expanded: isExpanded })}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

/**
 * 폴더 아이콘 (열림/닫힘 상태)
 */
export function FolderIcon({ isOpen, className, size = 18 }: FolderIconProps): ReactElement {
    if (isOpen) {
        // 열린 폴더 아이콘
        return (
            <svg
                className={classNames("folder-icon", "folder-open", className)}
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M20 19H4a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h10a2 2 0 012 2v2H6v6l2.5-6H22l-2.4 7.2A2 2 0 0118 19z" />
            </svg>
        );
    }

    // 닫힌 폴더 아이콘
    return (
        <svg
            className={classNames("folder-icon", "folder-closed", className)}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2H4z" />
        </svg>
    );
}

/**
 * 드래그 핸들 아이콘
 */
export function DragHandleIcon({ className, size = 16 }: IconProps): ReactElement {
    return (
        <svg
            className={classNames("drag-handle-icon", className)}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
        </svg>
    );
}

/**
 * 삭제 아이콘
 */
export function DeleteIcon({ className, size = 16 }: IconProps): ReactElement {
    return (
        <svg
            className={classNames("delete-icon", className)}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="3,6 5,6 21,6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
    );
}

/**
 * 추가 아이콘
 */
export function AddIcon({ className, size = 16 }: IconProps): ReactElement {
    return (
        <svg
            className={classNames("add-icon", className)}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}
