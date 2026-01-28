import { ReactElement, createElement } from "react";
import { GroupManagementPreviewProps } from "../typings/GroupManagementProps";

export function preview({ groupDataSource }: GroupManagementPreviewProps): ReactElement {
    return (
        <div className="group-management-preview">
            <p>Group Management Widget</p>
            {groupDataSource ? (
                <p>Data source: {typeof groupDataSource === "object" && groupDataSource !== null && "caption" in groupDataSource ? groupDataSource.caption : "Connected"}</p>
            ) : (
                <p>Please configure a data source</p>
            )}
        </div>
    );
}

export function getPreviewCss(): string {
    return require("./ui/GroupManagement.css");
}
