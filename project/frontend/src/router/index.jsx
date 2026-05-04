import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home";
import Search from "../pages/Search";
import Graph from "../pages/Graph";
import Placeholder from "../pages/Placeholder";
import AddPerson  from "../pages/AddPerson";
import ImportExport from "../pages/ImportExport";
import EditPerson from "../pages/EditPerson";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/search", element: <Search /> },
  { path: "/graph", element: <Graph /> },
  { path: "/stats", element: <Placeholder title="Статистика" /> },
  { path: "/import", element: <Placeholder title="Импорт" /> },
  { path: "/import_export", element: <ImportExport /> },
  { path: "/add", element: <AddPerson /> },
  { path: "/persons/:id/edit", element: <EditPerson /> },
]);
