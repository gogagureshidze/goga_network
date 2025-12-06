"use client";

import React, { useState, useEffect, useRef, useCallback, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";
import {
  Heart,
  X,
  MoreVertical,
  Trash2,
  Send,
  Eye,
  AlertCircle,
  GripVertical,
  Save,
  BarChart3,
  Info,
  CheckCircle2,
  Plus,
  Loader2,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getHighlightDetails,
  toggleStoryLike,
  commentOnStory,
  deleteHighlight,
  reorderHighlightStories,
  removeStoryFromHighlight,
  viewStory,
  getArchivedStoriesForSelection,
  addStoriesToHighlight,
  updateHighlightCover,
  updateHighlightDetails,
  toggleCommentLike,
  deleteStoryComment,
} from "../../../actions/highlightActions";

// --- UTILS ---
const isVideo = (url: string) => /\.(mp4|webm|ogg|mov)$/i.test(url);

// --- COMPONENT: Media Player ---
const MediaDisplay = ({
  src,
  alt,
  className,
  priority = false,
  muted = true,
  isPaused = false,
  onDurationChange,
  onComplete,
}: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  }, [isPaused]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.currentTime = 0;
  }, [src]);

  if (isVideo(src)) {
    return (
      <video
        ref={videoRef}
        src={src}
        className={className}
        muted={muted}
        playsInline
        autoPlay
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration * 1000;
          if (onDurationChange && d > 0) onDurationChange(d);
        }}
        onEnded={onComplete}
      />
    );
  }
  return (
    <Image src={src} alt={alt} fill className={className} priority={priority} />
  );
};

// --- TYPES ---
interface StoryItem {
  id: number;
  highlightStoryId: number;
  img: string;
  type: "active" | "archived";
  createdAt: Date | string;
  isLiked: boolean;
  likesList: any[];
  commentsList: any[];
  viewsList: any[];
}

// --- COMPONENT: Sortable Row ---
function SortableStoryItem({
  id,
  item,
  onRemove,
}: {
  id: number;
  item: StoryItem;
  onRemove: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    position: "relative" as "relative",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 mb-2 transition-all ${
        isDragging ? "opacity-50 ring-2 ring-orange-500 scale-105" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-2 hover:bg-white/10 rounded-lg"
      >
        <GripVertical className="w-5 h-5 text-white/40" />
      </div>
      <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-black/40">
        <MediaDisplay
          src={item.img}
          alt="story"
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1">
        <p className="text-white/80 text-xs font-mono">
          {formatDistanceToNow(new Date(item.createdAt))} ago
        </p>
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(item.highlightStoryId)}
        className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// --- COMPONENT: Notifications ---
const GlassNotification = ({ message, visible, type = "success" }: any) => {
  if (!visible) return null;
  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
      <div className="flex items-center gap-3 px-5 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
        {type === "success" ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-400" />
        )}
        <span className="text-white font-medium text-sm">{message}</span>
      </div>
    </div>
  );
};

// --- COMPONENT: Glass Confirm Modal ---
const GlassConfirmModal = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isProcessing,
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-[#1C1C1E] border border-white/10 p-6 rounded-3xl w-full max-w-xs shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <h3 className="text-white font-bold text-lg mb-1 text-center">
          {title}
        </h3>
        <p className="text-white/50 text-sm mb-6 text-center">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
export default function HighlightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const highlightId = parseInt(resolvedParams.id);
  const router = useRouter();

  // Core Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(
    null
  );

  // Story Logic
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(5000);

  // Touch Logic Ref
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const isTouchRef = useRef(false);

  // UI States
  const [notification, setNotification] = useState({
    visible: false,
    message: "",
    type: "success" as "success" | "error",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "",
    payload: null as any,
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [isCommentsClosing, setIsCommentsClosing] = useState(false);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [isEditClosing, setIsEditClosing] = useState(false);
  const [isInsightsClosing, setIsInsightsClosing] = useState(false);
  const [isAboutClosing, setIsAboutClosing] = useState(false);
  const [isAddStoriesClosing, setIsAddStoriesClosing] = useState(false);

  // Modals
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAddStories, setShowAddStories] = useState(false);

  // Edit About State
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Add Stories State
  const [archiveList, setArchiveList] = useState<any[]>([]);
  const [selectedArchives, setSelectedArchives] = useState<number[]>([]);
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);

  const [insightTab, setInsightTab] = useState<"views" | "likes">("views");
  const [commentText, setCommentText] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const notify = (message: string, type: "success" | "error" = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(
      () => setNotification((prev) => ({ ...prev, visible: false })),
      3000
    );
  };

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      try {
        const res = await getHighlightDetails(highlightId);
        if (!res) {
          setError("Highlight not found");
          return;
        }

        setData(res);
        setEditTitle(res.title || "");
        setEditDesc(res.desc || "");
        setCurrentUserId(res.currentUserId || "");
        setCurrentUserAvatar(res.currentUserAvatar || null);
        setIsOwner(res.currentUserId === res.userId);

        const validStories: StoryItem[] = res.stories
          .map((s: any) => {
            const storyData = s.story || s.archivedStory;
            if (!storyData) return null;
            return {
              id: storyData.id,
              highlightStoryId: s.id,
              img: storyData.img,
              type: s.story ? "active" : "archived",
              createdAt: storyData.createdAt,
              isLiked: s.context.isLiked,
              likesList: s.context.likesList || [],
              commentsList: s.context.commentsList || [],
              viewsList: s.context.viewsList || [],
            };
          })
          .filter((s): s is StoryItem => s !== null);

        if (validStories.length === 0) setError("Empty highlight.");
        else setStories(validStories);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [highlightId]);

  // --- DURATION RESET ---
  useEffect(() => {
    setCurrentDuration(5000);
  }, [currentIndex]);

  // --- VIEW TRACKING ---
  useEffect(() => {
    if (stories.length === 0 || !currentUserId || isOwner) return;
    const story = stories[currentIndex];
    if (!story) return;
    const alreadyViewed = story.viewsList.some(
      (v: any) => v.userId === currentUserId || v.user?.id === currentUserId
    );
    if (!alreadyViewed) {
      const newStories = [...stories];
      const newView = {
        userId: currentUserId,
        createdAt: new Date(),
        user: { id: currentUserId, username: "You", avatar: currentUserAvatar },
      };
      newStories[currentIndex].viewsList = [
        newView,
        ...newStories[currentIndex].viewsList,
      ];
      setStories(newStories);
      viewStory(story.id, story.type === "archived");
    }
  }, [currentIndex, stories.length, currentUserId, currentUserAvatar, isOwner]);

  // --- NAVIGATION ---
  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) setCurrentIndex((p) => p + 1);
    else router.back();
  }, [currentIndex, stories.length, router]);
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((p) => p - 1);
  }, [currentIndex]);

  // --- TOUCH LOGIC ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    holdTimer.current = setTimeout(() => setIsPaused(true), 200);
  };

  const handlePointerUp = (e: React.PointerEvent, pos: "left" | "right") => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    e.preventDefault();
    if (isPaused) setIsPaused(false);
    else {
      if (pos === "left") handlePrev();
      else handleNext();
    }
  };

  const handlePointerLeave = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (isPaused) setIsPaused(false);
  };

  // --- ACTIONS ---
  const handleLike = async () => {
    const storyIndex = currentIndex;
    const story = stories[storyIndex];
    if (!story) return;
    const previousLiked = story.isLiked;
    const newStories = [...stories];
    const currentItem = newStories[storyIndex];
    currentItem.isLiked = !previousLiked;
    if (!previousLiked) {
      const optimisticLike = {
        userId: currentUserId || "me",
        user: {
          id: currentUserId || "me",
          username: "You",
          avatar: currentUserAvatar,
        },
      };
      currentItem.likesList = [optimisticLike, ...currentItem.likesList];
    } else {
      currentItem.likesList = currentItem.likesList.filter((l: any) => {
        const idToCheck = l.userId || l.user?.id;
        return idToCheck !== currentUserId && idToCheck !== "me";
      });
    }
    setStories(newStories);
    try {
      await toggleStoryLike(story.id, story.type === "archived");
    } catch (e) {
      newStories[storyIndex].isLiked = previousLiked;
      setStories([...newStories]);
      notify("Failed to like", "error");
    }
  };
//! 
const closeModal = (
  modalName: "comments" | "menu" | "edit" | "insights" | "about" | "addStories"
) => {
  const closingMap = {
    comments: setIsCommentsClosing,
    menu: setIsMenuClosing,
    edit: setIsEditClosing,
    insights: setIsInsightsClosing,
    about: setIsAboutClosing,
    addStories: setIsAddStoriesClosing,
  };

  const showMap = {
    comments: setShowComments,
    menu: setShowMenu,
    edit: setShowEdit,
    insights: setShowInsights,
    about: setShowAbout,
    addStories: setShowAddStories,
  };

  closingMap[modalName](true);
  setTimeout(() => {
    showMap[modalName](false);
    closingMap[modalName](false);
    setIsPaused(false);
  }, 300);
};

const handlePostComment = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!commentText.trim()) return;

  const storyIndex = currentIndex;
  const story = stories[storyIndex];

  // 1. Create Temp ID
  const tempId = Date.now();

  const tempComment = {
    id: tempId, // ⚠️ Temporary ID
    desc: commentText,
    createdAt: new Date(),
    user: {
      id: currentUserId || "me",
      username: "Me",
      avatar: currentUserAvatar,
    },
  };

  // 2. Optimistic Update (Show immediately)
  const newStories = [...stories];
  newStories[storyIndex].commentsList = [
    tempComment,
    ...newStories[storyIndex].commentsList,
  ];
  setStories(newStories);
  setCommentText("");

  try {
    // 3. Call Server
    const res = await commentOnStory(
      story.id,
      story.type === "archived",
      tempComment.desc
    );

    // 4. ✅ SWAP TEMP ID WITH REAL ID
    if (res.success && res.newComment) {
      setStories((prevStories) => {
        const updatedStories = [...prevStories];
        const currentComments = updatedStories[storyIndex].commentsList;

        // Find the temp comment and update its ID
        const commentIndex = currentComments.findIndex((c) => c.id === tempId);
        if (commentIndex !== -1) {
          currentComments[commentIndex].id = res.newComment.id; // 🟢 NOW IT CAN BE DELETED
        }

        return updatedStories;
      });
    }
  } catch (e) {
    // Remove optimistic comment on fail
    setStories((prev) => {
      const reverted = [...prev];
      reverted[storyIndex].commentsList = reverted[
        storyIndex
      ].commentsList.filter((c) => c.id !== tempId);
      return reverted;
    });
    notify("Failed to post comment", "error");
  }
};

  const handleLikeComment = async (commentId: number) => {
    if (!isOwner) return;
    const newStories = [...stories];
    const targetComment = newStories[currentIndex].commentsList.find(
      (c: any) => c.id === commentId
    );
    if (targetComment) {
      const isArchived = stories[currentIndex].type === "archived";
      const isLiked = isArchived
        ? targetComment.likesCount > 0
        : targetComment.likes.length > 0;
      if (isArchived) targetComment.likesCount = isLiked ? 0 : 1;
      else {
        if (isLiked) targetComment.likes = [];
        else targetComment.likes = [{ userId: currentUserId }];
      }
      setStories(newStories);
      try {
        await toggleCommentLike(commentId, isArchived);
      } catch (e) {
        notify("Action failed", "error");
      }
    }
  };

  // --- MANAGEMENT ---
  const triggerDeleteHighlight = () => {
    setIsPaused(true);
    setConfirmModal({ isOpen: true, type: "DELETE_HIGHLIGHT", payload: null });
  };
  const triggerRemoveStory = (id: number) => {
    setConfirmModal({ isOpen: true, type: "REMOVE_STORY", payload: id });
  };

  // ✅ TRIGGER DELETE COMMENT (Opens Modal)
  const triggerDeleteComment = (commentId: number) => {
    setConfirmModal({
      isOpen: true,
      type: "DELETE_COMMENT",
      payload: commentId,
    });
  };

  const handleConfirmAction = async () => {
    setIsProcessingAction(true);
    try {
      if (confirmModal.type === "DELETE_HIGHLIGHT") {
        await deleteHighlight(highlightId);
        router.push("/");
      } else if (confirmModal.type === "REMOVE_STORY") {
        const idToRemove = confirmModal.payload;
        setStories((prev) => {
          const newS = prev.filter((s) => s.highlightStoryId !== idToRemove);
          if (newS.length === 0) {
            router.push("/");
            return [];
          }
          if (currentIndex >= newS.length) setCurrentIndex(newS.length - 1);
          return newS;
        });
        const res = await removeStoryFromHighlight(idToRemove);
        if (res.isEmpty) router.push("/");
        else notify("Story removed", "success");
      } else if (confirmModal.type === "DELETE_COMMENT") {
        // ✅ HANDLE DELETE COMMENT LOGIC HERE
        const commentId = confirmModal.payload;
        const newStories = [...stories];
        newStories[currentIndex].commentsList = newStories[
          currentIndex
        ].commentsList.filter((c: any) => c.id !== commentId);
        setStories(newStories);
        await deleteStoryComment(
          commentId,
          stories[currentIndex].type === "archived"
        );
        notify("Comment deleted", "success");
      }
    } catch (e) {
      notify("Action failed", "error");
    } finally {
      setIsProcessingAction(false);
      setConfirmModal({ isOpen: false, type: "", payload: null });
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setStories((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  const handleSaveOrder = async () => {
    try {
      const orderPayload = stories.map((s, index) => ({
        id: s.highlightStoryId,
        order: index,
      }));
      await reorderHighlightStories(highlightId, orderPayload);
      setShowEdit(false);
      setIsPaused(false);
      notify("Order saved", "success");
    } catch (e) {
      notify("Failed to save", "error");
    }
  };
  const handleOpenAddStories = async () => {
    setShowMenu(false);
    setShowAddStories(true);
    setIsLoadingArchives(true);
    try {
      const archives = await getArchivedStoriesForSelection(highlightId);
      setArchiveList(archives);
    } catch (e) {
      notify("Failed to load archives", "error");
    } finally {
      setIsLoadingArchives(false);
    }
  };
  const toggleArchiveSelection = (id: number) => {
    setSelectedArchives((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };
  const handleSaveAddedStories = async () => {
    if (selectedArchives.length === 0) return;
    setIsProcessingAction(true);
    try {
      await addStoriesToHighlight(highlightId, selectedArchives);
      notify("Stories added!", "success");
      window.location.reload();
    } catch (e) {
      notify("Failed to add stories", "error");
      setIsProcessingAction(false);
    }
  };

  const handleSaveAbout = async () => {
    if (!editTitle.trim()) return notify("Title required", "error");
    setIsProcessingAction(true);
    try {
      await updateHighlightDetails(highlightId, editTitle, editDesc);
      setData((prev: any) => ({ ...prev, title: editTitle, desc: editDesc }));
      setIsEditingAbout(false);
      notify("Details updated", "success");
    } catch (e) {
      notify("Failed to update", "error");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // --- RENDER ---
  if (loading)
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  if (error || !stories[currentIndex])
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white gap-4">
        <AlertCircle className="w-10 h-10" />
        <p>{error || "Empty"}</p>
        <button onClick={() => router.back()}>Back</button>
      </div>
    );

  const currentStory = stories[currentIndex];
  const activeInsightList =
    insightTab === "views" ? currentStory.viewsList : currentStory.likesList;
  const currentComments = currentStory.commentsList;
  const isGlobalPaused =
    isPaused ||
    showMenu ||
    showEdit ||
    showInsights ||
    showAbout ||
    showAddStories ||
    confirmModal.isOpen ||
    showComments;

  // Determine Modal Content Dynamically
  const getModalText = () => {
    switch (confirmModal.type) {
      case "DELETE_HIGHLIGHT":
        return {
          title: "Delete Highlight?",
          desc: "This will permanently delete this highlight.",
        };
      case "REMOVE_STORY":
        return {
          title: "Remove Story?",
          desc: "This story will be removed from this highlight.",
        };
      case "DELETE_COMMENT":
        return {
          title: "Delete Comment?",
          desc: "Are you sure you want to delete this comment?",
        };
      default:
        return { title: "Confirm", desc: "Are you sure?" };
    }
  };
  const modalContent = getModalText();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black font-sans">
      <style jsx global>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
      <GlassNotification
        message={notification.message}
        visible={notification.visible}
        type={notification.type}
      />

      {/* ✅ UNIFIED CONFIRM MODAL */}
      <GlassConfirmModal
        isOpen={confirmModal.isOpen}
        title={modalContent.title}
        description={modalContent.desc}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setConfirmModal({ isOpen: false, type: "", payload: null });
          setIsPaused(false);
        }}
        isProcessing={isProcessingAction}
      />

      <div className="absolute inset-0 z-0 opacity-40 blur-[100px] scale-110">
        <MediaDisplay
          src={currentStory.img}
          alt="bg"
          className="object-cover w-full h-full"
          muted
        />
      </div>

      <div className="relative z-10 w-full h-full md:w-[420px] md:h-[85vh] md:rounded-[40px] overflow-hidden bg-black/20 backdrop-blur-3xl shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col">
        {/* HEADER */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex gap-1 mb-3">
            {stories.map((s, idx) => (
              <div
                key={s.id}
                className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white origin-left"
                  style={{
                    width:
                      idx < currentIndex
                        ? "100%"
                        : idx > currentIndex
                        ? "0%"
                        : "100%",
                    animation:
                      idx === currentIndex
                        ? `progress ${currentDuration}ms linear`
                        : "none",
                    animationPlayState: isGlobalPaused ? "paused" : "running",
                  }}
                  onAnimationEnd={() => {
                    if (idx === currentIndex && !isVideo(currentStory.img))
                      handleNext();
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden relative border border-white/20">
                <Image
                  src={data.user?.avatar || "/noAvatar.png"}
                  alt="u"
                  fill
                  className="object-cover"
                />
              </div>
              <p className="text-white text-sm font-bold shadow-black drop-shadow-md">
                {data.title}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {isVideo(currentStory.img) && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white/90 hover:text-white transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setIsPaused(true);
                  setShowMenu(true);
                }}
                className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.back()}
                className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* MEDIA */}
        <div className="relative flex-1 bg-black/50">
          <MediaDisplay
            src={currentStory.img}
            alt="story"
            className="object-contain w-full h-full"
            muted={isMuted}
            isPaused={isGlobalPaused}
            onDurationChange={setCurrentDuration}
            onComplete={handleNext}
          />
          <div className="absolute inset-0 flex">
            {/* POINTER EVENTS */}
            <div
              className="w-1/3 h-full z-10 touch-none"
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp(e, "left")}
              onPointerLeave={handlePointerLeave}
            />
            <div
              className="w-2/3 h-full z-10 touch-none"
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp(e, "right")}
              onPointerLeave={handlePointerLeave}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 pb-8 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex gap-3 items-center">
            <button
              onClick={() => {
                setIsPaused(true);
                setShowComments(true);
              }}
              className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-full h-11 px-4 text-left text-white/50 text-sm"
            >
              Send message...
            </button>
            <button
              onClick={handleLike}
              className={`w-11 h-11 flex items-center justify-center backdrop-blur-md rounded-full border transition-all duration-300 ${
                currentStory.isLiked
                  ? "bg-rose-500/20 border-rose-500/50"
                  : "bg-white/10 border-white/10"
              }`}
            >
              <Heart
                className={`w-6 h-6 transition-all duration-300 ${
                  currentStory.isLiked
                    ? "fill-rose-500 text-rose-500 scale-110"
                    : "text-white scale-100"
                }`}
              />
            </button>
          </div>
        </div>

        {/* MODALS */}
        {showAddStories && (
          <div className="absolute inset-0 z-50 bg-[#121212] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-4 pt-6 flex items-center justify-between border-b border-white/10 bg-[#1C1C1E]">
              <h2 className="text-white font-bold text-lg">Add Stories</h2>
              <button
                onClick={handleSaveAddedStories}
                disabled={selectedArchives.length === 0 || isProcessingAction}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-bold disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Add ({selectedArchives.length})
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingArchives ? (
                <div className="flex justify-center mt-20">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              ) : archiveList.length === 0 ? (
                <p className="text-center text-white/40 mt-20">
                  No archived stories found.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {archiveList.map((story) => {
                    const isSelected = selectedArchives.includes(story.id);
                    return (
                      <div
                        key={story.id}
                        onClick={() => toggleArchiveSelection(story.id)}
                        className={`relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                          isSelected
                            ? "border-orange-500 scale-95"
                            : "border-transparent"
                        }`}
                      >
                        <MediaDisplay
                          src={story.img}
                          alt="archive"
                          className="object-cover w-full h-full"
                          muted
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 bg-[#1C1C1E] border-t border-white/10">
              <button
                onClick={() => {
                  setShowAddStories(false);
                  setIsPaused(false);
                }}
                className="w-full py-3 bg-white/10 rounded-xl text-white font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {showInsights && (
          <div className="absolute inset-0 z-50 bg-[#000000] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 pt-6 flex items-center justify-between bg-white/5 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">Story Activity</h2>
              <button
                onClick={() => {
                  setShowInsights(false);
                  setIsPaused(false);
                }}
                className="p-2 bg-white/10 rounded-full text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex p-2 gap-2">
              <button
                onClick={() => setInsightTab("views")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  insightTab === "views"
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60"
                }`}
              >
                Views ({currentStory.viewsList.length})
              </button>
              <button
                onClick={() => setInsightTab("likes")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  insightTab === "likes"
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60"
                }`}
              >
                Likes ({currentStory.likesList.length})
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeInsightList.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-700 relative overflow-hidden border border-white/10">
                    <Image
                      src={
                        item.user?.avatar || item.userAvatar || "/noAvatar.png"
                      }
                      alt="u"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">
                      {item.user?.username || item.username || "User"}
                    </p>
                  </div>
                  {insightTab === "likes" && (
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  )}{" "}
                  {insightTab === "views" && (
                    <Eye className="w-4 h-4 text-white/40" />
                  )}
                </div>
              ))}
              {activeInsightList.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-white/30">
                  <p>No {insightTab} for this story yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {showComments && (
          <div
            className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity duration-300 ${
              isCommentsClosing ? "opacity-0" : "animate-in fade-in"
            }`}
          >
            <div
              className="absolute inset-0"
              onClick={() => closeModal("comments")}
            />
            <div
              className={`relative bg-[#1C1C1E] rounded-t-3xl p-6 h-[70vh] flex flex-col transition-transform duration-300 ${
                isCommentsClosing
                  ? "translate-y-full"
                  : "translate-y-0 animate-in slide-in-from-bottom"
              }`}
            >
              {/* rest of the content stays the same */}
              <div
                onClick={() => closeModal("comments")}
                className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer"
              />
              <h3 className="text-white text-center font-bold text-lg mb-4">
                Comments
              </h3>
              <div className="flex-1 overflow-y-auto space-y-5 mb-4 pr-2">
                {currentComments.length === 0 ? (
                  <p className="text-center text-white/30 mt-10">
                    No comments yet.
                  </p>
                ) : (
                  currentComments.map((c: any) => {
                    const isLikedByAuthor =
                      currentStory.type === "archived"
                        ? c.likesCount > 0
                        : c.likes && c.likes.length > 0;
                    const isMyComment =
                      (c.userId || c.user?.id) === currentUserId;
                    const canDelete = isOwner || isMyComment;
                    return (
                      <div key={c.id} className="group flex gap-3 w-full">
                        <div className="w-8 h-8 rounded-full bg-gray-700 relative overflow-hidden flex-shrink-0">
                          <Image
                            src={
                              c.user?.avatar || c.userAvatar || "/noAvatar.png"
                            }
                            alt="u"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between">
                            <p className="text-white text-sm break-words">
                              <span className="font-bold mr-2 text-white">
                                {c.user?.username || c.username}
                              </span>
                              <span className="text-white/80">{c.desc}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-white/40 text-[10px]">
                              {formatDistanceToNow(new Date(c.createdAt))} ago
                            </span>
                            {isLikedByAuthor && (
                              <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded-md">
                                <div className="w-3 h-3 rounded-full overflow-hidden relative border border-white/20">
                                  <Image
                                    src={data.user?.avatar || "/noAvatar.png"}
                                    alt="creator"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <span className="text-[9px] text-white/60 font-medium">
                                  Liked by creator
                                </span>
                              </div>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => triggerDeleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-300 font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => handleLikeComment(c.id)}
                            className="self-start pt-1 pl-1"
                          >
                            <Heart
                              className={`w-4 h-4 transition-colors ${
                                isLikedByAuthor
                                  ? "fill-red-500 text-red-500"
                                  : "text-white/30 hover:text-white/60"
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={handlePostComment} className="relative">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-white/5 border border-white/10 rounded-full py-3 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-orange-500"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
        {showAbout && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center">
            <div
              className="absolute inset-0"
              onClick={() => {
                setShowAbout(false);
                setIsPaused(false);
                setIsEditingAbout(false);
              }}
            />
            <div className="relative w-full sm:w-[90%] bg-[#1C1C1E] sm:rounded-3xl rounded-t-3xl p-6 animate-in slide-in-from-bottom zoom-in-95 duration-300 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-xl">
                  {isEditingAbout ? "Edit Info" : "About Highlight"}
                </h3>
                <div className="flex gap-2">
                  {isOwner && !isEditingAbout && (
                    <button
                      onClick={() => setIsEditingAbout(true)}
                      className="p-2 bg-white/10 rounded-full text-white/80 hover:bg-white/20"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowAbout(false);
                      setIsPaused(false);
                      setIsEditingAbout(false);
                    }}
                    className="p-2 bg-white/10 rounded-full text-white/80"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {isEditingAbout ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 font-bold uppercase ml-1">
                      Title
                    </label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-white/30 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 font-bold uppercase ml-1">
                      Description
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-white/30 transition resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsEditingAbout(false)}
                      className="flex-1 py-3 bg-white/5 rounded-xl text-white font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAbout}
                      disabled={isProcessingAction}
                      className="flex-1 py-3 bg-orange-500 rounded-xl text-white font-bold flex justify-center items-center gap-2"
                    >
                      {isProcessingAction ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/10">
                      <Image
                        src={data.user?.avatar || "/noAvatar.png"}
                        alt="u"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">
                        {data.title}
                      </p>
                      <p className="text-white/50 text-sm">
                        @{data.user?.username}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <h4 className="text-white/40 text-xs font-bold uppercase mb-2">
                      Description
                    </h4>
                    <p className="text-white/90 leading-relaxed">
                      {data.desc || "No description provided."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {showMenu && (
          <div
            className={`absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end transition-opacity duration-300 ${
              isMenuClosing ? "opacity-0" : "animate-in fade-in"
            }`}
          >
            <div
              className="absolute inset-0"
              onClick={() => closeModal("menu")}
            />
            <div
              className={`relative bg-[#1C1C1E] rounded-t-3xl p-6 space-y-2 transition-transform duration-300 ${
                isMenuClosing
                  ? "translate-y-full"
                  : "translate-y-0 animate-in slide-in-from-bottom"
              }`}
            >
              <div
                onClick={() => closeModal("menu")}
                className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer"
              />
              <button
                onClick={() => {
                  closeModal("menu");
                  setTimeout(() => setShowAbout(true), 300);
                }}
                className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl text-white font-medium hover:bg-white/10"
              >
                <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center text-gray-300">
                  <Info className="w-5 h-5" />
                </div>
                About this Highlight
              </button>
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      closeModal("menu");
                      setTimeout(() => setShowInsights(true), 300);
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl text-white font-medium hover:bg-white/10"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    Activity & Insights
                  </button>
                  <button
                    onClick={() => {
                      closeModal("menu");
                      setTimeout(() => setShowEdit(true), 300);
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl text-white font-medium hover:bg-white/10"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    Edit & Reorder Stories
                  </button>
                  <button
                    onClick={() => {
                      closeModal("menu");
                      setTimeout(() => handleOpenAddStories(), 300);
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl text-white font-medium hover:bg-white/10"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                      <Plus className="w-5 h-5" />
                    </div>
                    Add Stories
                  </button>
                  <button
                    onClick={triggerDeleteHighlight}
                    className="w-full flex items-center gap-4 p-4 bg-red-500/10 rounded-2xl text-red-400 font-medium hover:bg-red-500/20 mt-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    Delete Highlight
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {showEdit && (
          <div className="absolute inset-0 z-50 bg-[#121212] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-4 pt-6 flex items-center justify-between border-b border-white/10 bg-[#1C1C1E]">
              <h2 className="text-white font-bold text-lg">Edit Highlight</h2>
              <div className="flex gap-2">
                <CldUploadWidget
                  uploadPreset="social"
                  options={{
                    resourceType: "image",
                    clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                  }}
                  onSuccess={(result: any) => {
                    updateHighlightCover(highlightId, result.info.secure_url)
                      .then(() => notify("Cover updated!", "success"))
                      .catch(() => notify("Failed to update", "error"));
                  }}
                >
                  {({ open }) => (
                    <button
                      onClick={() => open()}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-sm font-bold hover:bg-white/20 transition"
                    >
                      <ImageIcon className="w-4 h-4" /> Cover
                    </button>
                  )}
                </CldUploadWidget>
                <button
                  onClick={handleSaveOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-bold"
                >
                  <Save className="w-4 h-4" /> Done
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stories.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {stories.map((story) => (
                    <SortableStoryItem
                      key={story.id}
                      id={story.id}
                      item={story}
                      onRemove={triggerRemoveStory}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
