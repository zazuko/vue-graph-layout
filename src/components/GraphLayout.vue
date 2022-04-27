<script setup>
/* eslint-disable */
import { nextTick, onMounted, watch, ref } from 'vue'
import * as d3 from 'd3'
import { computeLayout, setupZoomArrowKeys, drag, renderSimulation } from './dagre.js'

const props = defineProps({
  // List of objects with an `id` property
  nodes: { required: true, type: Array },
  // List of objects with `label`, `source` and `target` properties
  links: { required: true, type: Array },
  // List of currently highlighted links
  activeLinks: { required: true, type: Array },
  // Adjust zoom level when nodes change
  autoZoom: { default: true },

  // https://g6.antv.vision/en/docs/api/graphLayout/dagre
  layoutCfg: {
    default: {
      rankdir: 'RL',
      // 'TB':Layout the graph from the top to the bottom;
      // 'BT':Layout the graph from the bottom to the top;
      // 'LR':Layout the graph from the top left the right;
      // 'RL':Layout the graph from the top right the left.
      align: undefined,
      // 'UL': aligns the nodes to the upper left;
      // 'UR': aligns the nodes to the upper right;
      // 'DL': aligns the nodes to the down left;
      // 'DR': aligns the nodes to the upper right;
      // undefined: default value, align to the center.
      nodesep: 20,
      ranksep: 50,
      marginx: 10,
      marginy: 10,
    }
  }
})

const emit = defineEmits(['link-enter', 'link-out'])

const layoutRef = ref()
const rootRef = ref()

async function renderGraph () {
  if (props.nodes.length === 0) return

  await nextTick()
  const container = rootRef.value// this.$el
  const containerSelection = d3.select(container)

  const root = d3.select(layoutRef.value)//(this.$refs.layout)

  // Copy to avoid mutating the props
  const nodes = props.nodes.map(node => ({ ...node }))
  const links = props.links.map(link => ({ ...link }))

  const layout = computeLayout(root, nodes, links, props.layoutCfg)
  const simulation = d3.forceSimulation().nodes(nodes)

  simulation
    .force('links', d3.forceLink(links).id(({ id }) => id).strength(0))
    .force('posX', d3.forceX().strength(1).x(node => layout.nodes[node.id].x))
    .force('posY', d3.forceY().strength(1).y(node => layout.nodes[node.id].y))
    .stop()

  root.style('width', `${layout.width}px`)
  root.style('height', `${layout.height}px`)

  // Setup pan-zoom
  const initScaleX = container.clientWidth / layout.width
  const initScaleY = container.clientHeight / layout.height
  const initScale = Math.min(initScaleX, initScaleY, 1)
  const initX = Math.max((container.clientWidth - (layout.width * initScale)) / 2, 0)
  const initY = Math.max((container.clientHeight - (layout.height * initScale)) / 2, 0)
  const zoom = d3.zoom().scaleExtent([0.1, 1.2]).on('zoom', ({ transform }) => {
    root.style('transform', `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`)
    root.style('transform-origin', '0 0')
  })
  containerSelection.call(zoom)
  setupZoomArrowKeys(containerSelection, zoom)
  if (props.autoZoom) {
    containerSelection.call(zoom.transform, d3.zoomIdentity.translate(initX, initY).scale(initScale))
  }

  // Draw lines for links
  const linkFromGraphLink = (graphLink) =>
    props.links.find(({ source, target }) => source === graphLink.source.id && target === graphLink.target.id)
  const linksSelection = root
    .select('.links')
    .selectAll('.link')
    .data(links)
    .on('mouseover', (event, graphLink) => {
      const link = linkFromGraphLink(graphLink)
      emit('link-enter', link)
    })
    .on('mouseout', (event, graphLink) => {
      const link = linkFromGraphLink(graphLink)
      emit('link-out', link)
    })

  const render = () => renderSimulation(nodesSelection, linksSelection, containerSelection)

  // Enable nodes drag & drop
  const nodesSelection = root.selectAll('.node')
    .data(nodes)
    .call(drag(simulation, render))

  // Run simulation for a defined number of steps
  // See https://github.com/d3/d3-force/blob/master/README.md#simulation_tick
  for (let i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
    simulation.tick()
  }
  render()
  // Remove all forces after simulation is finished to allow dragging nodes around without affecting the other nodes
  simulation
    .force('posX', null)
    .force('posY', null)
}

onMounted(async () => {
  await renderGraph()
})

watch(() => props.nodes, (value) => {
  renderGraph()
})

watch(() => props.layoutCfg, (value) => {
  renderGraph()
})

</script>

<template>
  <div ref="rootRef" class="graph-layout">
    <div ref="layoutRef" class="layout">
      <div v-for="node in nodes" :key="node.id" :data-id="node.id" class="node">
        <slot :node="node" name="node">
          Missing slot
        </slot>
      </div>
      <svg class="links">
        <defs>
          <marker
            id="arrow"
            class="fill-gray-600 dark:fill-gray-100"
            markerHeight="10" markerUnits="userSpaceOnUse"
            markerWidth="10"
            orient="auto" refX="10"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path class="link-arrow" d="M 0 0 L 10 5 L 0 10 z"/>
          </marker>
          <marker
            id="arrow-active"
            class="fill-primary-300"
            markerHeight="10" markerUnits="userSpaceOnUse"
            markerWidth="10"
            orient="auto" refX="10"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path class="link-arrow" d="M 0 0 L 10 5 L 0 10 z"/>
          </marker>
          <marker
            id="dot"
            class="fill-gray-600 dark:fill-gray-100"
            markerHeight="6" markerUnits="userSpaceOnUse"
            markerWidth="6"
            orient="auto" refX="50"
            refY="50"
            viewBox="0 0 100 100"
          >
            <circle class="link-start" cx="50" cy="50" r="50"/>
          </marker>
          <marker
            id="dot-active"
            class="fill-primary-300"
            markerHeight="6" markerUnits="userSpaceOnUse"
            markerWidth="6"
            orient="auto" refX="50"
            refY="50"
            viewBox="0 0 100 100"
          >
            <circle class="link-start" cx="50" cy="50" r="50"/>
          </marker>
        </defs>
        <path
          v-for="(link, index) in links"
          :key="index"
          :class="{ active: activeLinks.includes(link) }"
          class="link stroke-gray-700 dark:stroke-gray-100"
        >
          <title>{{ link.label }}</title>
        </path>
      </svg>
    </div>
    <slot></slot>
  </div>
</template>

<style>
.graph-layout {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.layout {
  position: relative;
}

.node {
  position: absolute;
}

.links {
  flex-grow: 1;
  flex-basis: 100%;
  /* Hack because I can't figure out how to make the SVG take the full parent width/height */
  overflow: visible;
  pointer-events: none;
}

.link {
  fill: transparent;
  stroke: black;
  stroke-width: 1;
  marker-end: url(#arrow);
  marker-start: url(#dot);
  pointer-events: all;
}

/* SVG 1 doesn't provide a way to style markers based on their referencing
 * element. To circumvent this limitation, I use one marker for the normal
 * state, and one marker for the active state. */
.link.active {
  z-index: 10;
  stroke: #FFB15E;
  stroke-width: 2;
  marker-end: url(#arrow-active);
  marker-start: url(#dot-active);
}
</style>
