/* @refresh reload */
import { render } from "solid-js/web";
import "../../src/interface";
import "./index.css";
import App from "./App.tsx";

const root = document.getElementById("root");

render(() => <App />, root!);
