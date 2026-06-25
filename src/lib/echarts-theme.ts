// Brutalist/Terminal ECharts theme
// Matches the design of the reference CCX dashboard

export const BRUTAL_COLORS = [
  '#14b8a6', // teal (primary - responses)
  '#3b82f6', // blue (chat)
  '#a855f7', // purple (messages)
  '#f97316', // orange (gemini)
  '#ec4899', // pink (images)
  '#10b981', // green
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#ef4444', // red
  '#8b5cf6', // violet
];

export function registerBrutalTheme(echarts: any): void {
  echarts.registerTheme('brutal', {
    color: BRUTAL_COLORS,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
    },
    title: {
      textStyle: {
        fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        fontWeight: 600,
      },
    },
    legend: {
      textStyle: {
        fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
        fontSize: 10,
        fontWeight: 600,
      },
      pageTextStyle: {
        fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
      },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: '#d1d5db', width: 1 } },
      axisTick: { lineStyle: { color: '#d1d5db' } },
      splitLine: { show: false },
      axisLabel: {
        fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
        fontSize: 10,
        fontWeight: 500,
        color: '#6b7280',
      },
    },
    valueAxis: {
      axisLine: { show: false },
      splitLine: {
        lineStyle: { color: '#e5e7eb', type: 'dashed', width: 1 },
      },
      axisLabel: {
        fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
        fontSize: 10,
        fontWeight: 500,
        color: '#9ca3af',
      },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      borderWidth: 1.5,
      textStyle: {
        fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
        fontSize: 11,
        color: '#1a1a1a',
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 4px 4px 0 0 rgba(0,0,0,0.12); border-radius: 0px;',
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
        width: 2,
      },
      symbolSize: 8,
    },
    pie: {
      itemStyle: {
        borderWidth: 1,
        borderColor: '#ffffff',
      },
    },
    series: {
      bar: {
        itemStyle: {
          borderRadius: 0,
        },
      },
    },
  });
}

// Get tooltip style matching the brutalist theme
export function getBrutalTooltip(): any {
  return {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderWidth: 1.5,
    textStyle: { fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace', color: '#1a1a1a', fontSize: 11 },
    padding: [8, 12] as [number, number],
    extraCssText: 'box-shadow: 4px 4px 0 0 rgba(0,0,0,0.12); border-radius: 0px;',
  };
}

// Dark mode tooltip
export function getBrutalTooltipDark(): any {
  return {
    backgroundColor: '#252525',
    borderColor: '#404040',
    borderWidth: 1.5,
    textStyle: { fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace', color: '#e5e5e5', fontSize: 11 },
    padding: [8, 12] as [number, number],
    extraCssText: 'box-shadow: 4px 4px 0 0 rgba(0,0,0,0.3); border-radius: 0px;',
  };
}

// Common grid configuration
export function getBrutalGrid(top = 40, right = 16, bottom = 28, left = 48): any {
  return { top, right, bottom, left, containLabel: true };
}

// Common axis configuration
export function getBrutalXAxis(data?: string[]): any {
  return {
    type: 'category',
    data,
    axisLine: { lineStyle: { color: '#d1d5db', width: 1 } },
    axisTick: { lineStyle: { color: '#d1d5db' } },
    splitLine: { show: false },
    axisLabel: {
      fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
      fontSize: 10,
      fontWeight: 500,
      color: '#6b7280',
    },
  };
}

export function getBrutalYAxis(name?: string): any {
  return {
    type: 'value',
    name,
    nameTextStyle: {
      fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
      fontSize: 10,
      fontWeight: 600,
      color: '#9ca3af',
    },
    axisLine: { show: false },
    splitLine: {
      lineStyle: { color: '#e5e7eb', type: 'dashed', width: 1 },
    },
    axisLabel: {
      fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace',
      fontSize: 10,
      fontWeight: 500,
      color: '#9ca3af',
    },
  };
}
