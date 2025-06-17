<script setup lang="ts">
import { computed, ref } from 'vue';

interface CharacterCardProps {
  name: string;
  description: string; // 仍然保留在props中但不在UI显示
  image?: string;
  creatorComment?: string;
  characterVersion?: string;
  createDate?: string;
  tags?: string[];
  creator?: string;
  talkativeness?: string; // 仍然保留但只用于筛选，不在UI显示
  favorite?: boolean;
  variant?: 'full' | 'compact'; // 新增 variant 属性
}

// 使用 withDefaults 设置默认值
const props = withDefaults(defineProps<CharacterCardProps>(), {
  variant: 'full',
  image: undefined,
  creatorComment: undefined,
  characterVersion: undefined,
  createDate: undefined,
  tags: () => [],
  creator: undefined,
  talkativeness: undefined,
  favorite: false,
});

// 格式化日期显示，将完整时间转换为只显示日期
const formattedDate = props.createDate ?
  props.createDate.split(' ')[0] :
  undefined;

// 点击卡片的处理函数（后续实现）
const handleCardClick = () => {
  // 默认打开这个角色卡的逻辑，后续实现
  console.debug('打开角色:', props.name);
}

// 菜单操作
const menuOptions = [
  { label: '编辑', action: () => console.debug('编辑:', props.name) },
  { label: '删除', action: () => console.debug('删除:', props.name) },
  { label: '导出', action: () => console.debug('导出:', props.name) },
  // 可以根据需要添加更多选项
];
// 直接使用原生事件监听来获取更精确的鼠标位置
const cardRef = ref<HTMLElement | null>(null);
const mousePosition = ref({ x: 0, y: 0 });
const isHovering = ref(false);

// 计算视差效果的转换值
const parallaxTransform = computed(() => {
  if (!isHovering.value) {
    return 'translate(0px, 0px) scale(1.05)';
  }

  // 计算相对于卡片中心的偏移量
  const cardWidth = cardRef.value?.offsetWidth || 300;
  const cardHeight = cardRef.value?.offsetHeight || 320;

  const offsetX = ((mousePosition.value.x / cardWidth) - 0.5) * -15;
  const offsetY = ((mousePosition.value.y / cardHeight) - 0.5) * -15;

  return `translate(${offsetX}px, ${offsetY}px) scale(1.1)`;
});

// 监听鼠标事件
const handleMouseMove = (e: MouseEvent) => {
  if (!cardRef.value) return;

  // 获取鼠标相对于卡片的位置
  const rect = cardRef.value.getBoundingClientRect();
  mousePosition.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
};

const handleMouseEnter = () => {
  isHovering.value = true;
};

const handleMouseLeave = () => {
  isHovering.value = false;
};

// 计算卡片的背景样式
const backgroundStyle = computed(() => {
  return {
    backgroundImage: props.image ? `url(${props.image})` : 'linear-gradient(to bottom, var(--ct-primary), var(--ct-secondary))',
    transform: parallaxTransform.value,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
});
</script>

<template>
  <div ref="cardRef" @mousemove="handleMouseMove" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave"
    @click="handleCardClick" :class="[
      'relative rounded-lg overflow-hidden cursor-pointer card-container transition-all duration-300',
      props.variant === 'full' ? 'w-[268px] h-[420px]' : 'w-32 h-48' // 根据 variant 设置尺寸
    ]">
    <!-- 背景层 - 使用视差效果移动 -->
    <div class="absolute inset-0 w-[calc(100%+30px)] h-[calc(100%+30px)] -left-[15px] -top-[15px]"
      :style="backgroundStyle"></div>

    <!-- 描边效果 -->
    <div class="absolute inset-0 rounded-lg card-border"></div>
    <!-- 半透明遮罩，使底部信息区域更易读 -->
    <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-70"></div>

    <!-- 角色信息 - 根据 variant 显示不同内容 -->
    <div v-if="props.variant === 'full'" class="absolute bottom-0 left-0 right-0 p-4 text-white">
      <!-- 创作者评论 -->
      <div v-if="creatorComment" class="mt-1 text-xs text-gray-300 italic line-clamp-2">
        "{{ creatorComment }}"
      </div>
      <!-- 创作者信息 -->
      <div class="mt-2 text-xs">
        <span v-if="creator" class="text-gray-300">作者: {{ creator }}</span>
      </div>
      <!-- 版本和创建日期 -->
      <div class="flex justify-between text-xs text-gray-300 mt-1">
        <span v-if="characterVersion">{{ characterVersion }}</span>
        <span v-if="formattedDate">{{ formattedDate }}</span>
      </div>
      <!-- 标签 -->
      <div class="flex flex-wrap gap-1 mt-2">
        <span v-for="(tag, index) in tags" :key="index"
          class="px-2 py-0.5 bg-background-surface bg-opacity-50 text-text-base rounded-full text-xs">
          {{ tag }}
        </span>
      </div>
      <!-- 角色名称和收藏 -->
      <div class="flex justify-between items-center mt-2">
        <h3 class="text-lg font-semibold truncate">{{ name }}</h3>
        <div v-if="favorite" class="text-yellow-400 ml-2 flex-shrink-0">
          <span>⭐</span>
        </div>
      </div>
    </div>

    <!-- 紧凑模式下的内容 -->
    <div v-else-if="props.variant === 'compact'" class="absolute bottom-0 left-0 right-0 p-2 text-white">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-medium truncate">{{ name }}</h3>
        <div v-if="favorite" class="text-yellow-400 ml-1 flex-shrink-0 text-xs">
          <span>⭐</span>
        </div>
      </div>
    </div>

    <!-- 三点菜单 (只在 full 模式下显示) -->
    <div v-if="props.variant === 'full'" class="absolute top-2 right-2 z-10">
      <div class="relative group">
        <button class="p-1 rounded-full bg-background-surface bg-opacity-50 text-primary-content hover:bg-opacity-70">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        <!-- 下拉菜单 -->
        <div
          class="absolute right-0 mt-1 w-36 bg-background-surface rounded-md shadow-lg overflow-hidden z-20 invisible group-hover:visible">
          <div class="py-1">
            <a v-for="(option, index) in menuOptions" :key="index" href="#"
              class="block px-4 py-2 text-sm text-text-base hover:bg-primary/10" @click.stop="option.action">
              {{ option.label }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保卡片有固定高度并正确显示图片 */
.group:hover .invisible {
  visibility: visible;
}

/* 卡片容器样式 */
.card-container {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: scale(1);
  will-change: transform;
}

.card-container:hover {
  transform: scale(1.03);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* 卡片内容悬停效果 */
.card-content {
  transition: transform 0.3s ease;
}

.card-container:hover .card-content {
  transform: translateY(-3px);
}

/* 卡片描边效果 */
.card-border {
  border: 2px solid transparent;
  border-radius: 0.5rem;
  transition: border-color 0.5s ease, box-shadow 0.5s ease;
  pointer-events: none;
}

.card-container:hover .card-border {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
}

/* 在暗色模式下调整描边颜色 */
:global(.dark) .card-container:hover .card-border {
  border-color: rgba(var(--ct-primary-rgb), 0.4);
  box-shadow: 0 0 15px rgba(var(--ct-primary-rgb), 0.3);
}
</style>