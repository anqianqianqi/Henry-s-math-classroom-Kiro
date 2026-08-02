/**
 * Decorations hub, book skins, challenge rooms and bundles.
 * Edit the `zh` values to change wording.
 */

export const decorations = {
  // ── Hub ──────────────────────────────────────────────────
  'decor.intro': {
    en: 'Personalise your classroom experience.',
    zh: '个性化您的课堂体验。',
  },
  'decor.adminTools': { en: 'Admin Tools', zh: '管理工具' },

  'decor.bookCoverPage': { en: 'Book Cover & Page', zh: '书封面与内页' },
  'decor.bookCoverPageSub': { en: 'Customise your challenge book', zh: '自定义您的挑战书' },
  'decor.bookCoverPageDesc': {
    en: 'Choose cover skins and page styles for the book that appears on every challenge.',
    zh: '为每道挑战题中出现的书本选择封面与内页样式。',
  },

  'decor.challengeRoom': { en: 'Challenge Room', zh: '挑战房间' },
  'decor.challengeRoomSub': { en: 'Your 3D reading room', zh: '您的 3D 阅读房间' },
  'decor.challengeRoomDesc': {
    en: 'Swap the flat book for a 3D room with an animated book, and pick the cover / inner-page bundle that wraps it.',
    zh: '把平面书本换成带动画书本的 3D 房间，并选择包裹它的封面与内页组合。',
  },

  'decor.petRoom': { en: 'Pet Room', zh: '宠物房间' },
  'decor.petRoomSub': { en: "Your pet's home background", zh: '宠物的家园背景' },
  'decor.petRoomDesc': {
    en: 'Browse and select room backgrounds for your pet area on the dashboard.',
    zh: '浏览并选择主页宠物区域的房间背景。',
  },

  // ── Collection management ────────────────────────────────
  'decor.noChallengeRoom': { en: 'NoChallengeRoom', zh: '不使用挑战房间' },
  'decor.setDefault': { en: 'Set default', zh: '设为默认' },
  'decor.isDefault': { en: 'Is Default', zh: '当前默认' },
  'decor.default': { en: 'Default', zh: '默认' },
  'decor.makePublic': { en: 'Make public', zh: '设为公开' },
  'decor.makePrivate': { en: 'Make private', zh: '设为私有' },
  'decor.activate': { en: 'Activate', zh: '启用' },
  'decor.deactivate': { en: 'Deactivate', zh: '停用' },
  'decor.sellInShop': { en: 'Sell in shop', zh: '上架商店' },
  'decor.inShop': { en: 'In shop', zh: '已上架' },
  'decor.public': { en: 'Public', zh: '公开' },
  'decor.adminOnly': { en: 'Admin only', zh: '仅管理员' },
  'decor.inactive': { en: 'Inactive', zh: '已停用' },
  'decor.active': { en: 'Active', zh: '使用中' },
  'decor.priceInPoints': { en: 'Price in points', zh: '价格（积分）' },
  'decor.list': { en: 'List', zh: '上架' },

  'decor.roomHeading': { en: 'Challenge Room', zh: '挑战房间' },
  'decor.roomDesc': {
    en: 'Replaces the flat book with a 3D room and an animated book. Desktop only, and only on challenges imported from a .henryproblem file.',
    zh: '用带动画书本的 3D 房间替代平面书本。仅在电脑端、且仅对由 .henryproblem 文件导入的挑战题生效。',
  },
  'decor.roomsEmpty': { en: 'No rooms yet.', zh: '暂无房间。' },
  'decor.roomsLoading': { en: 'Loading rooms…', zh: '房间加载中…' },
  'decor.optOutNotice': {
    en: 'Challenge rooms are off for you — challenges show the flat book. Turn NoChallengeRoom off, or pick a room below, to switch back.',
    zh: '您已关闭挑战房间，挑战题将显示平面书本。关闭“不使用挑战房间”或在下方选择一个房间即可恢复。',
  },
  'decor.defaultWarning': {
    en: 'Setting this as default turns the 3D room on for every student who has not chosen one — a launch switch, not just a label.',
    zh: '设为默认会为所有尚未自行选择的学生开启 3D 房间——这是正式启用的开关，而不只是一个标记。',
  },

  'decor.bundleHeading': { en: 'Book Cover / Inner Page Bundle', zh: '书封面与内页组合' },
  'decor.bundleDesc': {
    en: 'Wraps the 3D book in the Challenge Room. The cover shows when the book is closed, the inner page backs both open pages.',
    zh: '用于包裹挑战房间中的 3D 书本。合上时显示封面，翻开时两页均使用内页。',
  },
  'decor.bundlesEmpty': { en: 'No bundles yet.', zh: '暂无组合。' },
  'decor.bundlesLoading': { en: 'Loading bundles…', zh: '组合加载中…' },
  'decor.bundleNeedsRoom': {
    en: 'A bundle only applies inside a Challenge Room. Choose a room first and these become selectable.',
    zh: '组合仅在挑战房间中生效。请先选择一个房间，之后即可选择组合。',
  },
  'decor.useFlatBook': { en: 'Use the flat book instead', zh: '改用平面书本' },

  // ── Challenge room page ──────────────────────────────────
  'decor.roomPageIntro': {
    en: 'The Challenge Room replaces the flat book with a 3D room and an animated book. It appears on desktop, on challenges imported from a .henryproblem file.',
    zh: '挑战房间会用带动画书本的 3D 房间替代平面书本，仅在电脑端、且仅对由 .henryproblem 文件导入的挑战题显示。',
  },
  'decor.openRoomCollection': {
    en: 'Open Challenge Room collection →',
    zh: '打开挑战房间收藏 →',
  },
  'decor.loadingCollection': { en: 'Loading your collection…', zh: '收藏加载中…' },

  // ── Book & Cover collection ──────────────────────────────
  'skins.pageTitle': { en: 'Book & Cover', zh: '书本与封面' },
  'skins.personalise': { en: 'Personalise Your Book', zh: '个性化您的书本' },
  'skins.loadingCollection': { en: 'Loading your collection…', zh: '正在加载您的收藏…' },
  'skins.bookCover': { en: 'Book Cover', zh: '书本封面' },
  'skins.moreInShopNote': {
    en: 'More cover and page designs will be available in the Shop to unlock with your points.',
    zh: '更多封面和内页设计将在商店上架，可以用您的积分解锁。',
  },
  'skins.moreInShop': { en: 'More in Shop', zh: '更多在商店' },
  'skins.openRoomCollection': { en: 'Open Challenge Room collection →', zh: '打开挑战房间收藏 →' },
  'skins.challengeTitlePreview': { en: 'Challenge Title Preview', zh: '挑战题标题预览' },
  'skins.openTheBook': { en: 'Open the Book', zh: '打开这本书' },

  // ── Admin manage sheet ───────────────────────────────────
  'skins.manageThisSkin': { en: 'Manage this skin', zh: '管理这个皮肤' },
  'skins.typeCover': { en: 'Cover', zh: '封面' },
  'skins.typePage': { en: 'Page', zh: '内页' },
  'skins.visPublic': { en: 'Public', zh: '公开' },
  'skins.visAdminOnly': { en: 'Admin only', zh: '仅管理员' },
  'skins.isDefaultTag': { en: 'Default', zh: '默认' },
  'skins.inactiveTag': { en: 'Inactive', zh: '已停用' },
  'skins.inShopTag': { en: 'In shop', zh: '已上架' },
  'skins.isDefault': { en: 'Is Default', zh: '当前默认' },
  'skins.setDefault': { en: 'Set default', zh: '设为默认' },
  'skins.makePublic': { en: 'Make public', zh: '设为公开' },
  'skins.makePrivate': { en: 'Make private', zh: '设为私有' },
  'skins.activate': { en: 'Activate', zh: '启用' },
  'skins.deactivate': { en: 'Deactivate', zh: '停用' },
  'skins.sellInShop': { en: 'Sell in shop', zh: '在商店出售' },
  'skins.inShop': { en: 'In shop', zh: '已上架' },
  'skins.removeFromShop': { en: 'Remove from shop?', zh: '要从商店下架吗？' },
  'skins.delete': { en: 'Delete', zh: '删除' },
  'skins.editLayout': { en: 'Edit Title & Button Layout', zh: '编辑标题与按钮布局' },
  'skins.animateOverlays': { en: 'Animate Overlay Objects', zh: '设置装饰对象动画' },
  'skins.noneYet': { en: ' (none yet)', zh: '（暂无）' },
  'skins.pricePoints': { en: 'Price (points)', zh: '价格（积分）' },
  'skins.list': { en: 'List', zh: '上架' },

  // ── Pet room picker ──────────────────────────────────────
  'petRoom.intro': {
    en: 'Choose a room background for your pet on the dashboard.',
    zh: '为主页上的宠物挑选一个房间背景。',
  },
  'petRoom.none': { en: 'No room backgrounds available yet.', zh: '暂时还没有可用的房间背景。' },
  'petRoom.unavailable': { en: 'Unavailable', zh: '不可用' },
  'petRoom.owned': { en: 'Owned', zh: '已拥有' },
  'petRoom.active': { en: 'Active', zh: '使用中' },
  'petRoom.default': { en: 'Default', zh: '默认' },
  'petRoom.updatingPhoto': { en: 'Updating frame photo…', zh: '正在更新相框照片…' },
  'petRoom.viewFullSize': { en: 'View full size', zh: '查看原图' },

  // ── Challenge room collection page ───────────────────────
  //
  // These three are POSITIONAL: introA, then a link, then introB. Splitting a
  // sentence is normally wrong, but the link sits inside it and t() returns a
  // string, not JSX. It works because both languages put the link mid-sentence
  // — English '…the usual book from [link].' and Chinese '…仍会使用来自 [link]
  // 的普通书本。' — so introB carries the Chinese tail that follows the link.
  // If you reword these, keep that shape or the sentence breaks apart.
  'roomPage.introA': {
    en: 'The Challenge Room replaces the flat book with a 3D room and an animated book. It appears on desktop, on challenges imported from a .henryproblem file. Without a room selected you get the usual book from',
    zh: '挑战房间会把平面的书替换成 3D 房间和会翻页的书。它只在桌面端、且挑战题来自 .henryproblem 文件时出现。没有选择房间时，仍会使用来自',
  },
  'roomPage.introLink': { en: 'Book Cover & Page', zh: '书本与封面' },
  'roomPage.introB': { en: '.', zh: '的普通书本。' },
  'roomPage.radioIntro': {
    en: 'Some rooms have a radio on the window sill. Pick the colour yours is painted.',
    zh: '有些房间的窗台上放着一台收音机，你可以选择它的颜色。',
  },
  'templates.title': { en: 'Templates', zh: '模板' },
} as const
