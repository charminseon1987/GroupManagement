/**
 * This file was generated from GroupManagement.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, ListValue, Option, ListAttributeValue } from "mendix";
import { Big } from "big.js";

export interface GroupManagementContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    groupDataSource: ListValue;
    groupNameAttr: ListAttributeValue<string>;
    parentIdAttr: ListAttributeValue<string>;
    sortNoAttr: ListAttributeValue<Big>;
    depthAttr: ListAttributeValue<Big>;
    descriptionAttr?: ListAttributeValue<string>;
    enableAttr?: ListAttributeValue<boolean>;
    groupIdAttr?: ListAttributeValue<string | Big>;
    onTreeChange?: ActionValue<{ changesJson: Option<string> }>;
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
    groupNameAttr: string;
    parentIdAttr: string;
    sortNoAttr: string;
    depthAttr: string;
    descriptionAttr: string;
    enableAttr: string;
    groupIdAttr: string;
    onTreeChange: {} | null;
}
