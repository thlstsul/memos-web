import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import MemoFilter from "@/components/MemoFilter";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import { TAG_REG } from "@/labs/marked/parser";
import { useFilterStore, useMemoStore } from "@/store/module";
import { extractUsernameFromName } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import Empty from "./Empty";
import Memo from "./Memo";

const MemoList: React.FC = () => {
  const t = useTranslate();
  const params = useParams();
  const memoStore = useMemoStore();
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const { loadingStatus, memos } = memoStore.state;
  const user = useCurrentUser();
  const { tag: tagQuery, duration, text: textQuery, visibility } = filter;
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || textQuery || visibility);
  const username = params.username || extractUsernameFromName(user.name);

  const fetchMoreRef = useRef<HTMLSpanElement>(null);

  const shownMemos = (
    showMemoFilter
      ? memos.filter((memo) => {
          let shouldShow = true;

          if (tagQuery) {
            const tagsSet = new Set<string>();
            for (const t of Array.from(memo.content.match(new RegExp(TAG_REG, "gu")) ?? [])) {
              const tag = t.replace(TAG_REG, "$1").trim();
              const items = tag.split("/");
              let temp = "";
              for (const i of items) {
                temp += i;
                tagsSet.add(temp);
                temp += "/";
              }
            }
            if (!tagsSet.has(tagQuery)) {
              shouldShow = false;
            }
          }
          if (
            duration &&
            duration.from < duration.to &&
            (getTimeStampByDate(memo.displayTs) < duration.from || getTimeStampByDate(memo.displayTs) > duration.to)
          ) {
            shouldShow = false;
          }
          if (textQuery && !memo.content.toLowerCase().includes(textQuery.toLowerCase())) {
            shouldShow = false;
          }
          if (visibility) {
            shouldShow = memo.visibility === visibility;
          }

          return shouldShow;
        })
      : memos
  ).filter((memo) => memo.creatorUsername === username && memo.rowStatus === "NORMAL" && !memo.parent);

  const pinnedMemos = shownMemos.filter((m) => m.pinned);
  const unpinnedMemos = shownMemos.filter((m) => !m.pinned);
  const memoSort = (mi: Memo, mj: Memo) => {
    return mj.displayTs - mi.displayTs;
  };
  pinnedMemos.sort(memoSort);
  unpinnedMemos.sort(memoSort);
  const sortedMemos = pinnedMemos.concat(unpinnedMemos).filter((m) => m.rowStatus === "NORMAL");

  useEffect(() => {
    const root = document.body.querySelector("#root");
    if (root) {
      root.scrollTo(0, 0);
    }
  }, [filter]);

  useEffect(() => {
    memoStore.setLoadingStatus("incomplete");
  }, []);

  useEffect(() => {
    if (!fetchMoreRef.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      handleFetchMoreClick();
    });
    observer.observe(fetchMoreRef.current);

    return () => observer.disconnect();
  }, [loadingStatus]);

  const handleFetchMoreClick = async () => {
    try {
      await memoStore.fetchMemos(username, DEFAULT_MEMO_LIMIT, memos.length);
    } catch (error: any) {
      toast.error(error.response.data.message);
    }
  };

  return (
    <div className="flex flex-col justify-start items-start w-full max-w-full overflow-y-scroll pb-28 hide-scrollbar">
      <MemoFilter />
      {sortedMemos.map((memo) => (
        <Memo key={memo.id} memo={memo} lazyRendering showVisibility showPinnedStyle />
      ))}

      {loadingStatus === "fetching" ? (
        <div className="flex flex-col justify-start items-center w-full mt-2 mb-1">
          <p className="text-sm text-gray-400 italic">{t("memo.fetching-data")}</p>
        </div>
      ) : (
        <div className="flex flex-col justify-start items-center w-full my-6">
          <div className="text-gray-400 italic">
            {loadingStatus === "complete" ? (
              sortedMemos.length === 0 && (
                <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              )
            ) : (
              <span ref={fetchMoreRef} className="cursor-pointer hover:text-green-600" onClick={handleFetchMoreClick}>
                {t("memo.fetch-more")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoList;
