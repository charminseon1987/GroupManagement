import { ReactElement, createElement } from "react";
import { HelloWorldSample } from "./components/HelloWorldSample";

import { GroupManagementContainerProps } from "../typings/GroupManagementProps";

import "./ui/GroupManagement.css";

export function GroupManagement({ sampleText }: GroupManagementContainerProps): ReactElement {
    return <HelloWorldSample sampleText={sampleText ? sampleText : "World"} />;
}
