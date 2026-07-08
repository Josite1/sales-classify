// Tropical Botanical Greenhouse — ECharts theme
// Vibrant teal/emerald primary with high-saturation accent chart palette

export const TROPICAL_COLORS = [
  '#10b981', // emerald (primary)
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Keep legacy export for backwards compatibility
export const BRUTAL_COLORS = TROPICAL_COLORS;

export function registerBrutalTheme(echarts: any): void {
  echarts.registerTheme('brutal', {
    color: TROPICAL_COLORS,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 13,
    },
    title: {
      textStyle: {
        fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 15,
        fontWeight: 700,
        color: '#1a2e1a',
      },
    },
    legend: {
      textStyle: {
        fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 12,
        fontWeight: 600,
        color: '#5a7a5a',
      },
      pageTextStyle: {
        fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: '#d4e0d0', width: 1 } },
      axisTick: { lineStyle: { color: '#d4e0d0' } },
      splitLine: { show: false },
      axisLabel: {
        fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 12,
        fontWeight: 500,
        color: '#5a7a5a',
      },
    },
    valueAxis: {
      axisLine: { show: false },
      splitLine: {
        lineStyle: { color: '#e8f5e9', type: 'dashed', width: 1 },
      },
      axisLabel: {
        fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 12,
        fontWeight: 500,
        color: '#7a9a7a',
      },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#10b98140',
      borderWidth: 1,
      textStyle: {
        fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 13,
        color: '#1a2e1a',
      },
      padding: [10, 14],
      extraCssText: 'box-shadow: 0 4px 16px rgba(16,185,129,0.12), 0 2px 4px rgba(0,0,0,0.06); border-radius: 8px;',
    },
    bar: {
      itemStyle: {
        borderWidth: 0,
      },
    },
    line: {
      itemStyle: {
        borderWidth: 0,
      },
      lineStyle: {
        width: 2.5,
      },
      symbolSize: 9,
    },
    pie: {
      itemStyle: {
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    },
    series: {
      bar: {
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
      },
    },
  });
}

// Get tooltip style matching the tropical theme
export function getBrutalTooltip(): any {
  return {
    backgroundColor: '#ffffff',
    borderColor: '#10b98140',
    borderWidth: 1,
    textStyle: {
      fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      color: '#1a2e1a',
      fontSize: 13,
    },
    padding: [10, 14] as [number, number],
    extraCssText: 'box-shadow: 0 4px 16px rgba(16,185,129,0.12), 0 2px 4px rgba(0,0,0,0.06); border-radius: 8px;',
  };
}

// Dark mode tooltip
export function getBrutalTooltipDark(): any {
  return {
    backgroundColor: '#152915',
    borderColor: '#2d4a2d',
    borderWidth: 1,
    textStyle: {
      fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      color: '#dcecdc',
      fontSize: 13,
    },
    padding: [10, 14] as [number, number],
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.3); border-radius: 8px;',
  };
}

// Common grid configuration — slightly more padding for larger feel
export function getBrutalGrid(top = 44, right = 20, bottom = 32, left = 52): any {
  return { top, right, bottom, left, containLabel: true };
}

// Common axis configuration
export function getBrutalXAxis(data?: string[]): any {
  return {
    type: 'category',
    data,
    axisLine: { lineStyle: { color: '#d4e0d0', width: 1 } },
    axisTick: { lineStyle: { color: '#d4e0d0' } },
    splitLine: { show: false },
    axisLabel: {
      fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 500,
      color: '#5a7a5a',
    },
  };
}

export function getBrutalYAxis(name?: string): any {
  return {
    type: 'value',
    name,
    nameTextStyle: {
      fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 600,
      color: '#7a9a7a',
    },
    axisLine: { show: false },
    splitLine: {
      lineStyle: { color: '#e8f5e9', type: 'dashed', width: 1 },
    },
    axisLabel: {
      fontFamily: '"PingFang SC", system-ui, -apple-system, "PingFang SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 500,
      color: '#7a9a7a',
    },
  };
}
