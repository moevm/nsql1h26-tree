import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home";
import Search from "../pages/Search";
import Graph from "../pages/Graph";
import Placeholder from "../pages/Placeholder";
import AddPerson  from "../pages/AddPerson";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/search", element: <Search /> },
  { path: "/graph", element: <Graph /> },
  { path: "/stats", element: <Placeholder title="Статистика" /> },
  { path: "/import", element: <Placeholder title="Импорт" /> },
  { path: "/export", element: <Placeholder title="Экспорт" /> },
  { path: "/add", element: <AddPerson /> },
]);
