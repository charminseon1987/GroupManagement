import { ReactElement, createElement } from "react";
import { HelloWorldSample } from "./components/HelloWorldSample";
import { GroupManagementPreviewProps } from "../typings/GroupManagementProps";

export function preview({ sampleText }: GroupManagementPreviewProps): ReactElement {
    return <HelloWorldSample sampleText={sampleText} />;
}

export function getPreviewCss(): string {
    return require("./ui/GroupManagement.css");
}
