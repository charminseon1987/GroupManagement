/**
 * This file was generated from GroupManagement.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ListValue } from "mendix";

export interface GroupManagementContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    groupDataSource: ListValue;
}

export interface GroupManagementPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    groupDataSource: {} | { caption: string } | { type: string } | null;
}
