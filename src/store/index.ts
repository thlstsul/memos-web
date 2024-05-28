import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import dialogReducer from "./reducer/dialog";
import filterReducer from "./reducer/filter";
import resourceReducer from "./reducer/resource";

const store = configureStore({
  reducer: {
    filter: filterReducer,
    resource: resourceReducer,
    dialog: dialogReducer,
  },
});

type AppState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
export const useAppDispatch: () => AppDispatch = useDispatch;

export default store;
