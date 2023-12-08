import { Select, Option, Button, IconButton, Divider } from "@mui/joy";
import { isNumber, last, uniq, uniqBy } from "lodash-es";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { TAB_SPACE_WIDTH, UNKNOWN_ID, VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { clearContentQueryParam } from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import { getMatchedNodes } from "@/labs/marked";
import { useFilterStore, useGlobalStore, useMemoStore, useResourceStore, useTagStore, useUserStore } from "@/store/module";
import { Resource } from "@/types/proto/api/v2/resource_service";
import { User_Role } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";
import showCreateMemoRelationDialog from "../CreateMemoRelationDialog";
import showCreateResourceDialog from "../CreateResourceDialog";
import Icon from "../Icon";
import VisibilityIcon from "../VisibilityIcon";
import TagSelector from "./ActionButton/TagSelector";
import Editor, { EditorRefActions } from "./Editor";
import RelationListView from "./RelationListView";
import ResourceListView from "./ResourceListView";

const listItemSymbolList = ["- [ ] ", "- [x] ", "- [X] ", "* ", "- "];
const emptyOlReg = /^(\d+)\. $/;

interface Props {
  className?: string;
  editorClassName?: string;
  cacheKey?: string;
  memoId?: MemoId;
  relationList?: MemoRelation[];
  onConfirm?: () => void;
}

interface State {
  memoVisibility: Visibility;
  resourceList: Resource[];
  relationList: MemoRelation[];
  isUploadingResource: boolean;
  isRequesting: boolean;
}

const MemoEditor = (props: Props) => {
  const { className, editorClassName, cacheKey, memoId, onConfirm } = props;
  const { i18n } = useTranslation();
  const t = useTranslate();
  const contentCacheKey = `memo-editor-${cacheKey}`;
  const [contentCache, setContentCache] = useLocalStorage<string>(contentCacheKey, "");
  const {
    state: { systemStatus },
  } = useGlobalStore();
  const userStore = useUserStore();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const tagStore = useTagStore();
  const resourceStore = useResourceStore();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<State>({
    memoVisibility: "PRIVATE",
    resourceList: [],
    relationList: props.relationList ?? [],
    isUploadingResource: false,
    isRequesting: false,
  });
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [isInIME, setIsInIME] = useState(false);
  const editorRef = useRef<EditorRefActions>(null);
  const user = userStore.state.user as User;
  const setting = user.setting;
  const referenceRelations = memoId
    ? state.relationList.filter(
        (relation) => relation.memoId === memoId && relation.relatedMemoId !== memoId && relation.type === "REFERENCE"
      )
    : state.relationList.filter((relation) => relation.type === "REFERENCE");

  useEffect(() => {
    editorRef.current?.setContent(contentCache || "");
    handleEditorFocus();
  }, []);

  useEffect(() => {
    let visibility = setting.memoVisibility;
    if (systemStatus.disablePublicMemos && visibility === "PUBLIC") {
      visibility = "PRIVATE";
    }
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  }, [setting.memoVisibility, systemStatus.disablePublicMemos]);

  useEffect(() => {
    if (memoId) {
      memoStore.getMemoById(memoId ?? UNKNOWN_ID).then((memo) => {
        if (memo) {
          handleEditorFocus();
          setState((prevState) => ({
            ...prevState,
            memoVisibility: memo.visibility,
            resourceList: memo.resourceList,
            relationList: memo.relationList,
          }));
          if (!contentCache) {
            editorRef.current?.setContent(memo.content ?? "");
          }
        }
      });
    }
  }, [memoId]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!editorRef.current) {
      return;
    }

    const isMetaKey = event.ctrlKey || event.metaKey;
    if (isMetaKey) {
      if (event.key === "Enter") {
        handleSaveBtnClick();
        return;
      }
    }
    if (event.key === "Enter" && !isInIME) {
      const cursorPosition = editorRef.current.getCursorPosition();
      const contentBeforeCursor = editorRef.current.getContent().slice(0, cursorPosition);
      const rowValue = last(contentBeforeCursor.split("\n"));
      if (rowValue) {
        if (listItemSymbolList.includes(rowValue) || emptyOlReg.test(rowValue)) {
          event.preventDefault();
          editorRef.current.removeText(cursorPosition - rowValue.length, rowValue.length);
        } else {
          // unordered/todo list
          let matched = false;
          for (const listItemSymbol of listItemSymbolList) {
            if (rowValue.startsWith(listItemSymbol)) {
              event.preventDefault();
              editorRef.current.insertText("", `\n${listItemSymbol}`);
              matched = true;
              break;
            }
          }

          if (!matched) {
            // ordered list
            const olMatchRes = /^(\d+)\. /.exec(rowValue);
            if (olMatchRes) {
              const order = parseInt(olMatchRes[1]);
              if (isNumber(order)) {
                event.preventDefault();
                editorRef.current.insertText("", `\n${order + 1}. `);
              }
            }
          }
          editorRef.current?.scrollToCursor();
        }
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const tabSpace = " ".repeat(TAB_SPACE_WIDTH);
      const cursorPosition = editorRef.current.getCursorPosition();
      const selectedContent = editorRef.current.getSelectedContent();
      editorRef.current.insertText(tabSpace);
      if (selectedContent) {
        editorRef.current.setCursorPosition(cursorPosition + TAB_SPACE_WIDTH);
      }
      return;
    }
  };

  const handleMemoVisibilityChange = (visibility: Visibility) => {
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  };

  const handleUploadFileBtnClick = () => {
    showCreateResourceDialog({
      onConfirm: (resourceList) => {
        setState((prevState) => ({
          ...prevState,
          resourceList: [...prevState.resourceList, ...resourceList],
        }));
      },
    });
  };

  const handleAddMemoRelationBtnClick = () => {
    showCreateMemoRelationDialog({
      onConfirm: (memoIdList) => {
        setState((prevState) => ({
          ...prevState,
          relationList: uniqBy(
            [
              ...memoIdList.map((id) => ({ memoId: memoId || UNKNOWN_ID, relatedMemoId: id, type: "REFERENCE" as MemoRelationType })),
              ...state.relationList,
            ].filter((relation) => relation.relatedMemoId !== (memoId || UNKNOWN_ID)),
            "relatedMemoId"
          ),
        }));
      },
    });
  };

  const handleSetResourceList = (resourceList: Resource[]) => {
    setState((prevState) => ({
      ...prevState,
      resourceList,
    }));
  };

  const handleSetRelationList = (relationList: MemoRelation[]) => {
    setState((prevState) => ({
      ...prevState,
      relationList,
    }));
  };

  const handleUploadResource = async (file: File) => {
    setState((state) => {
      return {
        ...state,
        isUploadingResource: true,
      };
    });

    let resource = undefined;
    try {
      resource = await resourceStore.createResourceWithBlob(file);
    } catch (error: any) {
      console.error(error);
      toast.error(typeof error === "string" ? error : error.response.data.message);
    }

    setState((state) => {
      return {
        ...state,
        isUploadingResource: false,
      };
    });
    return resource;
  };

  const uploadMultiFiles = async (files: FileList) => {
    const uploadedResourceList: Resource[] = [];
    for (const file of files) {
      const resource = await handleUploadResource(file);
      if (resource) {
        uploadedResourceList.push(resource);
        if (memoId) {
          await resourceStore.updateResource({
            resource: Resource.fromPartial({
              id: resource.id,
              memoId,
            }),
            updateMask: ["memo_id"],
          });
        }
      }
    }
    if (uploadedResourceList.length > 0) {
      setState((prevState) => ({
        ...prevState,
        resourceList: [...prevState.resourceList, ...uploadedResourceList],
      }));
    }
  };

  const handleDropEvent = async (event: React.DragEvent) => {
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      event.preventDefault();
      await uploadMultiFiles(event.dataTransfer.files);
    }
  };

  const handlePasteEvent = async (event: React.ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.files.length > 0) {
      event.preventDefault();
      await uploadMultiFiles(event.clipboardData.files);
    }
  };

  const handleContentChange = (content: string) => {
    setHasContent(content !== "");
    if (content !== "") {
      setContentCache(content);
    } else {
      localStorage.removeItem(contentCacheKey);
    }
  };

  const handleSaveBtnClick = async () => {
    if (state.isRequesting) {
      return;
    }

    setState((state) => {
      return {
        ...state,
        isRequesting: true,
      };
    });
    const content = editorRef.current?.getContent() ?? "";
    try {
      if (memoId && memoId !== UNKNOWN_ID) {
        const prevMemo = await memoStore.getMemoById(memoId ?? UNKNOWN_ID);

        if (prevMemo) {
          await memoStore.patchMemo({
            id: prevMemo.id,
            content,
            visibility: state.memoVisibility,
            resourceIdList: state.resourceList.map((resource) => resource.id),
            relationList: state.relationList,
          });
        }
      } else {
        await memoStore.createMemo({
          content,
          visibility: state.memoVisibility,
          resourceIdList: state.resourceList.map((resource) => resource.id),
          relationList: state.relationList,
        });
        filterStore.clearFilter();
      }
      editorRef.current?.setContent("");
      clearContentQueryParam();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
    setState((state) => {
      return {
        ...state,
        isRequesting: false,
      };
    });

    // Upsert tag with the content.
    const matchedNodes = getMatchedNodes(content);
    const tagNameList = uniq(matchedNodes.filter((node) => node.parserName === "tag").map((node) => node.matchedContent.slice(1)));
    for (const tagName of tagNameList) {
      await tagStore.upsertTag(tagName);
    }

    setState((prevState) => ({
      ...prevState,
      resourceList: [],
    }));
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCheckBoxBtnClick = () => {
    if (!editorRef.current) {
      return;
    }
    const currentPosition = editorRef.current?.getCursorPosition();
    const currentLineNumber = editorRef.current?.getCursorLineNumber();
    const currentLine = editorRef.current?.getLine(currentLineNumber);
    let newLine = "";
    let cursorChange = 0;
    if (/^- \[( |x|X)\] /.test(currentLine)) {
      newLine = currentLine.replace(/^- \[( |x|X)\] /, "");
      cursorChange = -6;
    } else if (/^\d+\. |- /.test(currentLine)) {
      const match = currentLine.match(/^\d+\. |- /) ?? [""];
      newLine = currentLine.replace(/^\d+\. |- /, "- [ ] ");
      cursorChange = -match[0].length + 6;
    } else {
      newLine = "- [ ] " + currentLine;
      cursorChange = 6;
    }
    editorRef.current?.setLine(currentLineNumber, newLine);
    editorRef.current.setCursorPosition(currentPosition + cursorChange);
    editorRef.current?.scrollToCursor();
  };

  const handleCodeBlockBtnClick = () => {
    if (!editorRef.current) {
      return;
    }

    const cursorPosition = editorRef.current.getCursorPosition();
    const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
    if (prevValue === "" || prevValue.endsWith("\n")) {
      editorRef.current?.insertText("", "```\n", "\n```");
    } else {
      editorRef.current?.insertText("", "\n```\n", "\n```");
    }
    editorRef.current?.scrollToCursor();
  };

  const handleTagSelectorClick = useCallback((tag: string) => {
    editorRef.current?.insertText(`#${tag} `);
  }, []);

  const handleEditorFocus = () => {
    editorRef.current?.focus();
  };

  const editorConfig = useMemo(
    () => ({
      className: editorClassName ?? "",
      initialContent: "",
      placeholder: t("editor.placeholder"),
      onContentChange: handleContentChange,
      onPaste: handlePasteEvent,
    }),
    [i18n.language]
  );

  const allowSave = (hasContent || state.resourceList.length > 0) && !state.isUploadingResource && !state.isRequesting;

  const disableOption = (v: string) => {
    const isAdminOrHost = currentUser.role === User_Role.ADMIN || currentUser.role === User_Role.HOST;

    if (v === "PUBLIC" && !isAdminOrHost) {
      return systemStatus.disablePublicMemos;
    }
    return false;
  };

  return (
    <div
      className={`${
        className ?? ""
      } relative w-full flex flex-col justify-start items-start bg-white dark:bg-zinc-700 px-4 pt-4 rounded-lg border-2 border-gray-200 dark:border-zinc-600`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDrop={handleDropEvent}
      onFocus={handleEditorFocus}
      onCompositionStart={() => setIsInIME(true)}
      onCompositionEnd={() => setIsInIME(false)}
    >
      <Editor ref={editorRef} {...editorConfig} />
      <div className="relative w-full flex flex-row justify-between items-center pt-2 z-1">
        <div className="flex flex-row justify-start items-center">
          <TagSelector onTagSelectorClick={(tag) => handleTagSelectorClick(tag)} />
          <IconButton
            className="flex flex-row justify-center items-center p-1 w-auto h-auto mr-1 select-none rounded cursor-pointer text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-800 hover:shadow"
            onClick={handleUploadFileBtnClick}
          >
            <Icon.Image className="w-5 h-5 mx-auto" />
          </IconButton>
          <IconButton
            className="flex flex-row justify-center items-center p-1 w-auto h-auto mr-1 select-none rounded cursor-pointer text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-800 hover:shadow"
            onClick={handleAddMemoRelationBtnClick}
          >
            <Icon.Link className="w-5 h-5 mx-auto" />
          </IconButton>
          <IconButton
            className="flex flex-row justify-center items-center p-1 w-auto h-auto mr-1 select-none rounded cursor-pointer text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-800 hover:shadow"
            onClick={handleCheckBoxBtnClick}
          >
            <Icon.CheckSquare className="w-5 h-5 mx-auto" />
          </IconButton>
          <IconButton
            className="flex flex-row justify-center items-center p-1 w-auto h-auto mr-1 select-none rounded cursor-pointer text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-800 hover:shadow"
            onClick={handleCodeBlockBtnClick}
          >
            <Icon.Code className="w-5 h-5 mx-auto" />
          </IconButton>
        </div>
      </div>
      <ResourceListView resourceList={state.resourceList} setResourceList={handleSetResourceList} />
      <RelationListView relationList={referenceRelations} setRelationList={handleSetRelationList} />
      <Divider className="!mt-2" />
      <div className="w-full flex flex-row justify-between items-center py-3 dark:border-t-zinc-500">
        <div className="relative flex flex-row justify-start items-center" onFocus={(e) => e.stopPropagation()}>
          <Select
            variant="plain"
            value={state.memoVisibility}
            startDecorator={<VisibilityIcon visibility={state.memoVisibility} />}
            onChange={(_, visibility) => {
              if (visibility) {
                handleMemoVisibilityChange(visibility);
              }
            }}
          >
            {VISIBILITY_SELECTOR_ITEMS.map((item) => (
              <Option key={item} value={item} className="whitespace-nowrap" disabled={disableOption(item)}>
                {t(`memo.visibility.${item.toLowerCase() as Lowercase<typeof item>}`)}
              </Option>
            ))}
          </Select>
        </div>
        <div className="shrink-0 flex flex-row justify-end items-center">
          <Button color="success" disabled={!allowSave} onClick={handleSaveBtnClick}>
            {t("editor.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MemoEditor;
