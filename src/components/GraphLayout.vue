<template>
  <div class="graph-layout">
    <div ref="layout" class="layout">
      <div v-for="node in nodes" :key="node.id" class="node" :data-id="node.id">
        <slot name="node" :node="node"> Missing slot </slot>
      </div>
      <svg class="links">
        <defs>
          <marker id="dot" viewBox="0 0 100 100" refX="50" refY="50" markerUnits="userSpaceOnUse" markerWidth="6"
            markerHeight="6" orient="auto" class="fill-gray-600 dark:fill-gray-100">
            <circle cx="50" cy="50" r="50" class="link-start" />
          </marker>
          <marker id="dot-active" viewBox="0 0 100 100" refX="50" refY="50" markerUnits="userSpaceOnUse" markerWidth="6"
            markerHeight="6" orient="auto" class="fill-primary-300">
            <circle cx="50" cy="50" r="50" class="link-start" />
          </marker>
        </defs>
        <g class="link-container" v-for="(link, index) in links" :key="index">
          <path class="link stroke-gray-700 dark:stroke-gray-100" :class="{ active: activeLinks.includes(link) }">
            <title>{{ link.label }}</title>
          </path>
          <path class="arrow-head fill-gray-600 dark:fill-gray-100" :class="{ active: activeLinks.includes(link) }">
          </path>
        </g>
      </svg>
    </div>
    <slot></slot>
  </div>
</template>

<script>
/* eslint-disable */
import { nextTick } from 'vue'
import * as d3 from 'd3'
import dagre from 'dagre'

export default {
  name: 'GraphLayout',
  props: {
    // List of objects with an `id` property
    nodes: { required: true, type: Array },
    // List of objects with `label`, `source` and `target` properties
    links: { required: true, type: Array },
    // List of currently highlighted links
    activeLinks: { required: true, type: Array },
    // Adjust zoom level when nodes change
    autoZoom: { default: true },
    layoutCfg: {
      type: Object,
      /**
       rankdir: The direction in which the graph is laid out. Can be "TB" (top to bottom), "BT" (bottom to top), "LR" (left to right), or "RL" (right to left).
       align: Determines how the nodes are aligned within their rank. Can be "UL" (up and left), "UR" (up and right), "DL" (down and left), "DR" (down and right), or undefined.
       nodesep: The minimum distance between nodes on the same rank.
       ranksep: The minimum distance between ranks.
       marginx: The margin to be added to the left and right of the graph.
       marginy: The margin to be added to the top and bottom of the graph.

       */
      default: function() {
        return {
          rankdir: 'RL',
          align: undefined,
          nodesep: 20,
          ranksep: 50,
          marginx: 10,
          marginy: 10
        }
      }
    }
  },
  emits: ['link-enter', 'link-out'],

  mounted() {
    this.renderGraph()
  },

  watch: {
    nodes() {
      this.renderGraph()
    },
    layoutCfg: {
      handler: 'onLayoutCfgChange',
      deep: true
    }
  },

  methods: {
    onLayoutCfgChange() {
      this.renderGraph()
    },
    async renderGraph() {
      if (this.nodes.length === 0) return

      await nextTick()

      const container = this.$el
      const containerSelection = d3.select(container)
      const root = d3.select(this.$refs.layout)


      // Copy to avoid mutating the props
      const nodes = this.nodes.map((node) => ({ ...node }))
      const links = this.links.map((link) => ({ ...link }))

      const layout = computeLayout(root, nodes, links, this.layoutCfg)
      const simulation = d3.forceSimulation().nodes(nodes)

      simulation
        .force(
          'links',
          d3
            .forceLink(links)
            .id(({ id }) => id)
            .strength(0)
        )
        .force(
          'posX',
          d3
            .forceX()
            .strength(1)
            .x((node) => layout.nodes[node.id].x)
        )
        .force(
          'posY',
          d3
            .forceY()
            .strength(1)
            .y((node) => layout.nodes[node.id].y)
        )
        .stop()

      root.style('width', `${layout.width}px`)
      root.style('height', `${layout.height}px`)

      // Setup pan-zoom
      const initScaleX = container.clientWidth / layout.width
      const initScaleY = container.clientHeight / layout.height
      const initScale = Math.min(initScaleX, initScaleY, 1)
      const initX = Math.max(
        (container.clientWidth - layout.width * initScale) / 2,
        0
      )
      const initY = Math.max(
        (container.clientHeight - layout.height * initScale) / 2,
        0
      )
      const zoom = d3
        .zoom()
        .scaleExtent([0.1, 1.2])
        .on('zoom', ({ transform }) => {
          root.style(
            'transform',
            `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`
          )
          root.style('transform-origin', '0 0')
        })
      containerSelection.call(zoom)
      setupZoomArrowKeys(containerSelection, zoom)
      if (this.autoZoom) {
        containerSelection.call(
          zoom.transform,
          d3.zoomIdentity.translate(initX, initY).scale(initScale)
        )
      }

      // Draw lines for links
      const linkFromGraphLink = (graphLink) =>
        this.links.find(
          ({ source, target }) =>
            source === graphLink.source.id && target === graphLink.target.id
        )
      const linksSelection = root
        .select('.links')
        .selectAll('.link')
        .data(links)
        .on('mouseover', (event, graphLink) => {
          const link = linkFromGraphLink(graphLink)
          this.$emit('link-enter', link)
        })
        .on('mouseout', (event, graphLink) => {
          const link = linkFromGraphLink(graphLink)
          this.$emit('link-out', link)
        })

      const arrowHeadSelection = root
        .select('.links')
        .selectAll('.arrow-head')
        .data(links)
        .on('mouseover', (event, graphLink) => {
          const link = linkFromGraphLink(graphLink)
          this.$emit('link-enter', link)
        })
        .on('mouseout', (event, graphLink) => {
          const link = linkFromGraphLink(graphLink)
          this.$emit('link-out', link)
        })

      const render = () =>
        renderSimulation(
          nodesSelection,
          linksSelection,
          containerSelection,
          arrowHeadSelection
        )
      // bbb find zoom scale
      const containerElt = containerSelection.node()

      // Enable nodes drag & drop
      const nodesSelection = root
        .selectAll('.node')
        .data(nodes)
        .call(drag(simulation, render, containerElt))

      // Run simulation for a defined number of steps
      // See https://github.com/d3/d3-force/blob/master/README.md#simulation_tick
      for (
        let i = 0,
        n = Math.ceil(
          Math.log(simulation.alphaMin()) /
          Math.log(1 - simulation.alphaDecay())
        );
        i < n;
        ++i
      ) {
        simulation.tick()
      }
      render()

      // Remove all forces after simulation is finished to allow dragging nodes around without affecting the other nodes
      simulation.force('posX', null).force('posY', null)
    }
  }
}

function renderSimulation(nodes, links, container, arrowHeads) {
  const containerElt = container.node()
  const currentScale = d3.zoomTransform(containerElt).k

  // Update node positions
  nodes.join().attr('style', (d) => {
    if (isNaN(d.x) || isNaN(d.y)) {
      // this is mitigating the problem
      // https://github.com/zazuko/SPEX/issues/66
      d.x = 300
      d.y = 300
    }
    return `left: ${d.x}px; top: ${d.y}px`
  }
  )
  // Update link positions
  const computeLinkPath = d3
    .linkHorizontal()
    .source((d) => sourcePoint(d, containerElt, currentScale))
    .target((d) => targetClosestAnchor(d, containerElt, currentScale))
    .x(({ x }) => x)
    .y(({ y }) => y)

  const arrowHeadPathFunction = (d) => {
    const targetPoint = targetClosestAnchor(d, containerElt, currentScale)
    return 'M -10 -5 L 0 0 L -10 5 z'
  }

  const arrowHeadTransformOrigin = (d) => {
    const cubicBezierPath = computeLinkPath(d)
    const points = cubicBezierPath
      .split('C')[1]
      .split(',')
      .map((s) => new Number(s.trim()).valueOf())

    const start = cubicBezierPath
      .split('C')[0]
      .replace('M', '')
      .split(',')
      .map((s) => new Number(s.trim()).valueOf())

    const control1 = [points[0], points[1]]
    const control2 = [points[2], points[3]]
    const end = [points[4], points[5]]

    const angle = interpolateCubicBezierAngle(start, control1, control2, end)
    return `translate(${end[0]}, ${end[1]}) rotate(${angle(0.95)})`
  }
  links.attr('d', computeLinkPath)
  arrowHeads.attr('d', arrowHeadPathFunction)
  arrowHeads.attr('transform', arrowHeadTransformOrigin)
}

// Setup drag & drop
function drag(simulation, renderSimulation, containerElt) {
  let start_x = 0;
  let start_y = 0;

  function dragstarted(event, d) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart()
    }
    start_x = event.x
    start_y = event.y

    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    const currentScale = d3.zoomTransform(containerElt).k
    d.fx = (start_x + (event.x - start_x) / currentScale)
    d.fy = (start_y + (event.y - start_y) / currentScale);
    renderSimulation()
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
    renderSimulation()
  }

  return d3
    .drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

/**
 * Property link source point
 */
function sourcePoint(d, container, scale) {
  const radius = 3
  const sourceNodeElt = container.querySelector(`[data-id="${d.source.id}"]`)
  const sourcePropertyElt = sourceNodeElt.querySelector(
    `[data-id="${d.sourceProperty}"]`
  )

  const sourceElt = sourcePropertyElt ?? sourceNodeElt
  const offsetX =
    d.target.x > d.source.x ? sourceElt.clientWidth + radius : -radius

  const offsetY = sourcePropertyElt
    ? sourcePropertyElt.getBoundingClientRect().y / scale -
    sourceNodeElt.getBoundingClientRect().y / scale +
    sourcePropertyElt.clientHeight / 2
    : sourceNodeElt.clientHeight / 2

  return {
    x: d.source.x + offsetX,
    y: d.source.y + offsetY
  }
}

/**
 * Find closest point to link to target node
 */
function targetClosestAnchor(d, container, scale) {
  const targetElt = container.querySelector(`[data-id="${d.target.id}"]`)
  const source = sourcePoint(d, container, scale)
  return nearestPointOnPerimeter(
    source,
    d.target,
    targetElt.clientWidth,
    targetElt.clientHeight
  )
}

function clamp(x, lower, upper) {
  return Math.max(lower, Math.min(upper, x))
}

function nearestPointOnPerimeter(point, rectTopLeft, rectWidth, rectHeight) {
  const rectBottomRight = {
    x: rectTopLeft.x + rectWidth,
    y: rectTopLeft.y + rectHeight
  }

  const x = clamp(point.x, rectTopLeft.x, rectBottomRight.x)
  const y = clamp(point.y, rectTopLeft.y, rectBottomRight.y)

  const dl = Math.abs(x - rectTopLeft.x)
  const dr = Math.abs(x - rectBottomRight.x)
  const dt = Math.abs(y - rectTopLeft.y)
  const db = Math.abs(y - rectBottomRight.y)
  const m = Math.min(dl, dr, dt, db)

  if (m === dt) {
    return { x, y: rectTopLeft.y }
  } else if (m === db) {
    return { x, y: rectBottomRight.y }
  } else if (m === dl) {
    return { x: rectTopLeft.x, y }
  } else {
    return { x: rectBottomRight.x, y }
  }
}

// Compute graph layout using Dagre
function computeLayout(root, nodes, links, layoutCfg) {
  const g = new dagre.graphlib.Graph()

  g.setGraph(layoutCfg)

  // Default to assigning a new object as a label for each new edge.
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((node) => {
    const elt = root.select(`[data-id="${node.id}"]`)
    const width = elt.style('width').replace('px', '')
    const height = elt.style('height').replace('px', '')

    g.setNode(node.id, { width, height })
  })

  links.forEach(({ source, target }) => {
    g.setEdge(source, target)
  })

  dagre.layout(g)

  return {
    width: g._label.width,
    height: g._label.height,
    nodes: g.nodes().reduce((acc, id) => {
      const node = g.node(id)

      return {
        ...acc,
        [id]: {
          id,
          x: node.x - node.width / 2,
          y: node.y - node.height / 2
        }
      }
    }, {})
  }
}

function setupZoomArrowKeys(container, zoom) {
  d3.select('body').on('keydown', (event) => {
    if (event.target.localName !== 'body') return

    const step = 50
    const translation = {
      ArrowUp: [0, step],
      ArrowRight: [-step, 0],
      ArrowDown: [0, -step],
      ArrowLeft: [step, 0]
    }[event.key]

    if (translation) {
      container.call(zoom.translateBy, ...translation)
    }
  })
}
function interpolateCubicBezierAngle(start, control1, control2, end) {
  // 0 <= t <= 1
  // M 123.21089999999982,131.9999999999999 C 99.6054499999999,131.9999999999999, 99.6054499999999,77.99999999999999,   75.99999999999997,77.99999999999999
  return function interpolator(t) {
    const tangentX =
      3 * Math.pow(1 - t, 2) * (control1[0] - start[0]) +
      6 * (1 - t) * t * (control2[0] - control1[0]) +
      3 * Math.pow(t, 2) * (end[0] - control2[0])
    const tangentY =
      3 * Math.pow(1 - t, 2) * (control1[1] - start[1]) +
      6 * (1 - t) * t * (control2[1] - control1[1]) +
      3 * Math.pow(t, 2) * (end[1] - control2[1])
    return Math.atan2(tangentY, tangentX) * (180 / Math.PI)
  }
}
</script>

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
  marker-start: url(#dot);
  pointer-events: all;
}

/* SVG 1 doesn't provide a way to style markers based on their referencing
 * element. To circumvent this limitation, I use one marker for the normal
 * state, and one marker for the active state. */
.link.active {
  z-index: 10;
  stroke: #ffb15e;
  stroke-width: 2;
  marker-start: url(#dot-active);
}

.arrow-head {
  stroke-width: 1;
  pointer-events: all;
}

.arrow-head.active {
  z-index: 10;
  stroke: #ffb15e;
  stroke-width: 1;
  fill: #ffb15e;
}
</style>
