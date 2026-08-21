import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "./PopupApp";
import "../styles/base.less";
import "./popup.less";
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <PopupApp />
    </StrictMode>,
);
