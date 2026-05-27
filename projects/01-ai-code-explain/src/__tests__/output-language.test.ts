import { describe, it, expect } from "vitest";
import {
  detectTextLanguage,
  isLanguageMatch,
  detectResultLanguage,
  resolveOutputLanguage,
  getLanguageInstruction,
} from "../output-language.js";
import type { LanguageCheckResult } from "../output-language.js";

// resolveOutputLanguage 的核心逻辑已在 prompts.test.ts 中覆盖，此处只补边界

describe("detectTextLanguage", () => {
  it("空字符串返回 null", () => {
    expect(detectTextLanguage("")).toBeNull();
  });

  it("纯空白返回 null", () => {
    expect(detectTextLanguage("   ")).toBeNull();
  });

  it("纯中文返回 zh-CN", () => {
    expect(detectTextLanguage("这是一个移动端首页组件")).toBe("zh-CN");
  });

  it("纯英文返回 en", () => {
    expect(detectTextLanguage("This is a mobile home page component")).toBe("en");
  });

  it("中文数量 >= 英文单词数时返回 zh-CN", () => {
    expect(detectTextLanguage("这是一个 home 组件")).toBe("zh-CN");
  });

  it("英文单词数 > 中文字符数时返回 en", () => {
    expect(detectTextLanguage("This is 一个 home page component with many English words")).toBe(
      "en",
    );
  });

  it("纯数字和符号返回 null", () => {
    expect(detectTextLanguage("123 456 !@#$")).toBeNull();
  });

  it("中文句子中夹杂代码标识符仍应返回 zh-CN", () => {
    // dependencies/components 中常见的代码标识符不应单独检测，但这里测的是
    // 如果标识符真的混在 summary 文本里，中文占优时仍判 zh-CN
    expect(detectTextLanguage("该组件使用了 useUserInfo 和 BannerSwiper，负责首页展示")).toBe(
      "zh-CN",
    );
  });
});

describe("isLanguageMatch", () => {
  it("actual 为 null 时返回 true（无法判断则放行）", () => {
    expect(isLanguageMatch(null, "zh-CN")).toBe(true);
    expect(isLanguageMatch(null, "en")).toBe(true);
  });

  it("语言一致返回 true", () => {
    expect(isLanguageMatch("zh-CN", "zh-CN")).toBe(true);
    expect(isLanguageMatch("en", "en")).toBe(true);
  });

  it("语言不一致返回 false", () => {
    expect(isLanguageMatch("zh-CN", "en")).toBe(false);
    expect(isLanguageMatch("en", "zh-CN")).toBe(false);
  });
});

describe("detectResultLanguage", () => {
  it("只基于 summary 判断语言，忽略 dependencies/components/risks 中的代码标识符", () => {
    const result: LanguageCheckResult = {
      summary: "这是一个移动端首页组件，展示用户信息和活动卡片",
      dependencies: ["@/hooks/useUserInfo", "@/api/home", "react", "lodash"],
      components: ["BannerSwiper", "ActivityCard", "UserProfile"],
      risks: ["useEffect lacks cleanup", "missing error boundary"],
    };
    // summary 是中文，即使数组里全是英文标识符，也应判断为 zh-CN
    expect(detectResultLanguage(result)).toBe("zh-CN");
  });

  it("英文 summary + 中文数组内容 → en", () => {
    const result: LanguageCheckResult = {
      summary: "This is the main home page component for displaying user info and activities",
      dependencies: ["@/hooks/useUserInfo"],
      components: ["BannerSwiper"],
      risks: ["异步错误未处理", "内存泄漏风险"],
    };
    expect(detectResultLanguage(result)).toBe("en");
  });

  it("summary 为空时返回 null", () => {
    const result: LanguageCheckResult = {
      summary: "",
      dependencies: ["auth", "api"],
      components: ["App"],
      risks: [],
    };
    expect(detectResultLanguage(result)).toBeNull();
  });

  it("summary 为纯符号时返回 null", () => {
    const result: LanguageCheckResult = {
      summary: "---",
      dependencies: [],
      components: [],
      risks: [],
    };
    expect(detectResultLanguage(result)).toBeNull();
  });
});

describe("getLanguageInstruction", () => {
  it("zh-CN 返回中文指令", () => {
    expect(getLanguageInstruction("zh-CN")).toContain("中文");
  });

  it("en 返回英文指令", () => {
    expect(getLanguageInstruction("en")).toContain("英文");
  });
});
