import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OptionsApp } from "./OptionsApp";
import "../styles/base.less";
import "./options.less";
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <OptionsApp />
    </StrictMode>,
);
