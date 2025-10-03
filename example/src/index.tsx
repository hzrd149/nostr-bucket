/* @refresh reload */
import { render } from "solid-js/web";
import "../../src/interface";
import "./index.css";
import App from "./App.tsx";

const root = document.getElementById("root");

// Mount after 100ms to ensure the interface is injected
setTimeout(async () => {
  // polyfill
  await import("window.nostrdb.js");
  render(() => <App />, root!);
}, 100);
