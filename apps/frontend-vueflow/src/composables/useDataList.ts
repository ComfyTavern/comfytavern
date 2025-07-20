import { ref, computed, watch, type Ref } from 'vue';
import type { SortConfig, FilterConfig } from '@comfytavern/types';
import { useDebounceFn } from '@vueuse/core';

// 定义 useDataList 的选项
export interface UseDataListOptions<T> {
  // 数据获取函数，由调用者提供
  fetcher: (params: {
    sort?: SortConfig<T>;
    filter?: FilterConfig;
    // pagination?: PaginationConfig; // 未来可以添加分页
  }) => Promise<T[]>;

  // 初始排序和筛选配置
  initialSort?: SortConfig<T>;
  initialFilter?: FilterConfig;

  // 客户端/服务端排序筛选模式切换
  serverSide?: boolean; // 默认为 false (客户端处理)
}

export function useDataList<T extends { [key: string]: any }>(options: UseDataListOptions<T>) {
  const {
    fetcher,
    initialSort = { field: 'name', direction: 'asc' }, // 默认值
    initialFilter = { searchTerm: '' },
    serverSide = false,
  } = options;

  // --- 核心状态 ---
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const rawItems = ref<T[]>([]) as Ref<T[]>; // 从 API 获取的原始数据

  // --- 排序和筛选状态 ---
  const sort = ref<SortConfig<T>>(initialSort) as Ref<SortConfig<T>>;
  const filter = ref<FilterConfig>(initialFilter) as Ref<FilterConfig>;

  // --- 选择状态 ---
  const selectedItems = ref<T[]>([]) as Ref<T[]>;

  // --- 数据获取 ---
  const fetchData = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const params = {
        ...(serverSide && { sort: sort.value }),
        ...(serverSide && { filter: filter.value }),
      };
      rawItems.value = await fetcher(params);
    } catch (e: any) {
      error.value = e;
      console.error('Failed to fetch data list:', e);
    } finally {
      isLoading.value = false;
    }
  };

  // --- 客户端处理逻辑 ---
  const processedItems = computed(() => {
    if (serverSide) {
      return rawItems.value; // 服务端模式下直接返回原始数据
    }

    let items = [...rawItems.value];

    // 客户端筛选 (简单实现)
    if (filter.value.searchTerm) {
      const term = filter.value.searchTerm.toLowerCase();
      items = items.filter(item =>
        JSON.stringify(item).toLowerCase().includes(term)
      );
    }

    // 客户端排序
    const { field, direction } = sort.value;
    items.sort((a, b) => {
      const valA = a[field as keyof T];
      const valB = b[field as keyof T];

      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      const comparison = valA < valB ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });

    return items;
  });

  // --- 方法 ---
  const setSort = (newSort: SortConfig<T>) => {
    sort.value = newSort;
  };

  const setSearchTerm = useDebounceFn((term: string) => {
    filter.value = { ...filter.value, searchTerm: term };
  }, 300);

  const setSelection = (selection: T[]) => {
    selectedItems.value = selection;
  };

  // --- 监听变化 ---
  watch([sort, filter], () => {
    if (serverSide) {
      fetchData();
    }
  }, { deep: true });

  // 初始加载
  fetchData();

  return {
    // 状态
    isLoading,
    error,
    items: processedItems, // 始终暴露处理后的数据
    selectedItems,
    sort,
    filter,

    // 方法
    fetchData,
    setSort,
    setSearchTerm,
    setSelection,
  };
}