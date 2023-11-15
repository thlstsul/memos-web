import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import MemoContent from "@/components/MemoContent";
import MemoResourceListView from "@/components/MemoResourceListView";
import { UNKNOWN_ID } from "@/helpers/consts";
import { getDateTimeString } from "@/helpers/datetime";
import useLoading from "@/hooks/useLoading";
import { useMemoStore } from "@/store/module";

interface State {
  memo: Memo;
}

const EmbedMemo = () => {
  const params = useParams();
  const memoStore = useMemoStore();
  const [state, setState] = useState<State>({
    memo: {
      id: UNKNOWN_ID,
    } as Memo,
  });
  const loadingState = useLoading();

  useEffect(() => {
    const memoId = Number(params.memoId);
    if (memoId && !isNaN(memoId)) {
      memoStore
        .fetchMemoById(memoId)
        .then((memo) => {
          setState({
            memo,
          });
          loadingState.setFinish();
        })
        .catch((error) => {
          toast.error(error.response.data.message);
        });
    }
  }, []);

  return (
    <section className="w-full h-full flex flex-row justify-start items-start p-2">
      {!loadingState.isLoading && (
        <div className="w-full max-w-lg mx-auto my-auto shadow px-4 py-4 rounded-lg">
          <div className="w-full flex flex-col justify-start items-start">
            <div className="w-full mb-2 flex flex-row justify-start items-center text-sm text-gray-400 dark:text-gray-300">
              <span>{getDateTimeString(state.memo.displayTs)}</span>
              <a className="ml-2 hover:underline hover:text-green-600" href={`/u/${state.memo.creatorUsername}`}>
                @{state.memo.creatorName}
              </a>
            </div>
            <MemoContent className="memo-content" content={state.memo.content} onMemoContentClick={() => undefined} />
            <MemoResourceListView resourceList={state.memo.resourceList} />
          </div>
        </div>
      )}
    </section>
  );
};

export default EmbedMemo;
