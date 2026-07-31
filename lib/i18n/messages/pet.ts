/**
 * The virtual pet: species, evolution stages, feeding and accessories.
 *
 * Pet names are chosen by the student and stay as typed.
 */

export const pet = {
  'pet.title': { en: 'My Pet', zh: '我的宠物' },
  'pet.loading': { en: 'Loading…', zh: '加载中…' },
  'pet.balance': { en: 'Balance', zh: '余额' },
  'pet.goToShop': { en: 'Go to Shop', zh: '前往商店' },
  'pet.accessories': { en: 'Accessories', zh: '配饰' },
  'pet.unnamed': { en: 'Unnamed Pet', zh: '未命名的宠物' },
  'pet.yourPet': { en: 'Your pet', zh: '你的宠物' },
  'pet.namePlaceholder': { en: 'Name your pet', zh: '给宠物起个名字' },
  'pet.clickToRename': { en: 'Click to rename', zh: '点击重命名' },

  // ── Species ──────────────────────────────────────────────
  'pet.speciesDragon': { en: 'Dragon', zh: '龙' },
  'pet.speciesFox': { en: 'Fox', zh: '狐狸' },
  'pet.speciesCat': { en: 'Cat', zh: '猫' },
  'pet.speciesGeneric': { en: 'Pet', zh: '宠物' },

  /**
   * Stage names interpolate the species rather than concatenating two
   * translated words. Chinese puts the modifier first as English does — 幼年龙
   * — but it takes no space, which a join in code would always insert.
   */
  'pet.stageBaby': { en: 'Baby {species}', zh: '幼年{species}' },
  'pet.stageTeen': { en: 'Teen {species}', zh: '少年{species}' },
  'pet.stageAdult': { en: 'Adult {species}', zh: '成年{species}' },
  'pet.stageLegendary': { en: 'Legendary {species}', zh: '传说{species}' },

  // ── Evolution ────────────────────────────────────────────
  'pet.isNowA': { en: '{name} is now a', zh: '{name} 进化成了' },
  'pet.amazing': { en: 'Amazing! 🐾', zh: '太棒了！🐾' },

  // ── Restart ──────────────────────────────────────────────
  'pet.startOverFromEgg': { en: 'Start over from egg', zh: '从蛋重新开始' },
  'pet.startOverTitle': { en: 'Start Over?', zh: '要重新开始吗？' },
  'pet.startOverBody': {
    en: 'This will reset your pet back to an egg. Your XP, species, and equipped accessories will be cleared. This cannot be undone.',
    zh: '这会把你的宠物变回一颗蛋。经验值、种族和已装备的配饰都会清空，且无法撤销。',
  },
  'pet.resetting': { en: 'Resetting…', zh: '正在重置…' },
  'pet.yesStartOver': { en: 'Yes, Start Over', zh: '确定重新开始' },

  // ── Errors ───────────────────────────────────────────────
  'pet.errNameEmpty': { en: 'Name cannot be empty', zh: '名字不能为空' },
  'pet.errNameTooLong': { en: 'Max 20 characters', zh: '最多 20 个字符' },
  'pet.errNameChars': {
    en: 'Letters, numbers, spaces and hyphens only',
    zh: '只能使用字母、数字、空格和连字符',
  },
  'pet.errSaveName': { en: 'Failed to save name', zh: '名字保存失败' },
  'pet.errSpecies': {
    en: 'Failed to select species. Please try again.',
    zh: '选择种族失败，请重试。',
  },
  'pet.errRestart': { en: 'Failed to restart. Please try again.', zh: '重置失败，请重试。' },
  'pet.errEquip': {
    en: 'Failed to equip accessory. Please try again.',
    zh: '装备配饰失败，请重试。',
  },
  'pet.errUnequip': {
    en: 'Failed to unequip accessory. Please try again.',
    zh: '卸下配饰失败，请重试。',
  },
} as const
