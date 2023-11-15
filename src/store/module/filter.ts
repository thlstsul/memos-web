import store, { useAppSelector } from "..";
import { Filter, setFilter } from "../reducer/filter";

export const useFilterStore = () => {
  const state = useAppSelector((state) => state.filter);

  return {
    state,
    getState: () => {
      return store.getState().filter;
    },
    setFilter: (filter: Filter) => {
      store.dispatch(setFilter(filter));
    },
    clearFilter: () => {
      store.dispatch(
        setFilter({
          tag: undefined,
          duration: undefined,
          text: undefined,
          visibility: undefined,
        })
      );
    },
    setTextFilter: (text?: string) => {
      store.dispatch(
        setFilter({
          text: text,
        })
      );
    },
    setTagFilter: (tag?: string) => {
      store.dispatch(
        setFilter({
          tag: tag,
        })
      );
    },
    setFromAndToFilter: (from?: number, to?: number) => {
      let duration = undefined;
      if (from && to && from < to) {
        duration = {
          from,
          to,
        };
      }
      store.dispatch(
        setFilter({
          duration,
        })
      );
    },
    setMemoVisibilityFilter: (visibility?: Visibility) => {
      store.dispatch(
        setFilter({
          visibility: visibility,
        })
      );
    },
  };
};
