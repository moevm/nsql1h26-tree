import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home";
import Search from "../pages/Search";
import Placeholder from "../pages/Placeholder";
import AddPerson  from "../pages/AddPerson";
import ImportExport from "../pages/ImportExport";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/search", element: <Search /> },
  { path: "/graph", element: <Placeholder title="Граф" /> },
  { path: "/stats", element: <Placeholder title="Статистика" /> },
  { path: "/import_export", element: <ImportExport /> },
  { path: "/add", element: <AddPerson /> },
]);
