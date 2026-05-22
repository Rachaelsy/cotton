Page({
  data: {
    statusBarHeight: 20,

    /* 分类标签 */
    categories: ['全部', '病虫害防治', '种植技术', '水肥管理', '政策解读', '机械化'],
    activeCategory: '全部',

    /* 顶部特色专家 Banner */
    banners: [
      {
        id: 1,
        avatar: '👨‍🔬',
        name: '王建国 博士',
        org: '新疆农科院植棉专家',
        title: '棉花高产栽培技术',
        status: 'live',
        statusText: '直播中',
        bg: '#4E342E'
      },
      {
        id: 2,
        avatar: '👨‍🏫',
        name: '李明 教授',
        org: '中国农业大学',
        title: '病虫害综合防治',
        status: 'upcoming',
        statusText: '即将开始',
        bg: '#5D4037'
      }
    ],

    /* 全部课程 */
    allCourses: [
      {
        id: 1,
        icon: '🌱',
        title: '2026年棉花播种技术要点',
        teacher: '张维民',
        titleName: '研究员',
        org: '新疆农科院',
        students: 1234,
        duration: '42分钟',
        category: '种植技术',
        tag: '免费',
        tagColor: '#4CAF50'
      },
      {
        id: 2,
        icon: '🦟',
        title: '棉蚜防治实操指南',
        teacher: '阿里木江',
        titleName: '农技师',
        org: '疏附县农业局',
        students: 892,
        duration: '28分钟',
        category: '病虫害防治',
        tag: '免费',
        tagColor: '#4CAF50'
      },
      {
        id: 3,
        icon: '💧',
        title: '膜下滴灌高效用水技术',
        teacher: '刘海峰',
        titleName: '教授',
        org: '塔里木大学',
        students: 2341,
        duration: '55分钟',
        category: '水肥管理',
        tag: '免费',
        tagColor: '#4CAF50'
      },
      {
        id: 4,
        icon: '🤖',
        title: '无人机植保作业规范',
        teacher: '机手培训',
        titleName: '',
        org: '极飞科技',
        students: 567,
        duration: '35分钟',
        category: '机械化',
        tag: '免费',
        tagColor: '#4CAF50'
      },
      {
        id: 5,
        icon: '📋',
        title: '2026年棉花补贴政策解读',
        teacher: '马玉珍',
        titleName: '',
        org: '疏附县农业局',
        students: 3102,
        duration: '20分钟',
        category: '政策解读',
        tag: '免费',
        tagColor: '#4CAF50'
      }
    ],

    /* 过滤后展示的课程 */
    filteredCourses: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });
    this._applyFilter('全部');
  },

  _applyFilter(cat) {
    const all = this.data.allCourses;
    const result = cat === '全部' ? all : all.filter(c => c.category === cat);
    this.setData({ filteredCourses: result, activeCategory: cat });
  },

  onCategoryTap(e) {
    const val = e.currentTarget.dataset.val;
    this._applyFilter(val);
  },

  onBannerTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/expert/detail?id=${id}&from=banner` });
  },

  onCourseTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/expert/detail?id=${id}` });
  },

  onBack() {
    wx.navigateBack();
  }
});
