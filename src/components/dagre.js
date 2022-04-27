import * as d3 from 'd3'
import dagre from 'dagre'

/* eslint-disable */
function renderSimulation (nodes, links, container) {
  const containerElt = container.node()
  const currentScale = d3.zoomTransform(containerElt).k

  // Update node positions
  nodes
    .join()
    .attr('style', (d) => `left: ${d.x}px; top: ${d.y}px`)

  // Update link positions
  const computeLinkPath = d3
    .linkHorizontal()
    .source((d) => sourcePoint(d, containerElt, currentScale))
    .target((d) => targetClosestAnchor(d, containerElt, currentScale))
    .x(({ x }) => x)
    .y(({ y }) => y)

  links.attr('d', computeLinkPath)
}

// Setup drag & drop
function drag (simulation, renderSimulation) {
  function dragstarted (event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged (event, d) {
    d.fx = event.x
    d.fy = event.y
    renderSimulation()
  }

  function dragended (event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
    renderSimulation()
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)
}

/**
 * Property link source point
 */
function sourcePoint (d, container, scale) {
  const radius = 3
  const sourceNodeElt = container.querySelector(`[data-id="${d.source.id}"]`)
  const sourcePropertyElt = sourceNodeElt.querySelector(`[data-id="${d.sourceProperty}"]`)

  const sourceElt = sourcePropertyElt ?? sourceNodeElt
  const offsetX = d.target.x > d.source.x
    ? (sourceElt.clientWidth + radius)
    : -radius

  const offsetY = sourcePropertyElt
    ? (
      (
        (sourcePropertyElt.getBoundingClientRect().y / scale) -
        (sourceNodeElt.getBoundingClientRect().y / scale)
      ) +
      (sourcePropertyElt.clientHeight / 2)
    )
    : sourceNodeElt.clientHeight / 2

  return {
    x: d.source.x + offsetX,
    y: d.source.y + offsetY,
  }
}

/**
 * Find closest point to link to target node
 */
function targetClosestAnchor (d, container, scale) {
  const targetElt = container.querySelector(`[data-id="${d.target.id}"]`)
  const source = sourcePoint(d, container, scale)
  return nearestPointOnPerimeter(source, d.target, targetElt.clientWidth, targetElt.clientHeight)
}

function clamp (x, lower, upper) {
  return Math.max(lower, Math.min(upper, x))
}

function nearestPointOnPerimeter (point, rectTopLeft, rectWidth, rectHeight) {
  const rectBottomRight = {
    x: rectTopLeft.x + rectWidth,
    y: rectTopLeft.y + rectHeight,
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
function computeLayout (root, nodes, links, layoutCfg) {
  const g = new dagre.graphlib.Graph()

  g.setGraph(layoutCfg)

  // Default to assigning a new object as a label for each new edge.
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach(node => {
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
          x: node.x - (node.width / 2),
          y: node.y - (node.height / 2),
        }
      }
    }, {}),
  }
}

function setupZoomArrowKeys (container, zoom) {
  d3.select('body').on('keydown', (event) => {
    if (event.target.localName !== 'body') return

    const step = 50
    const translation = {
      ArrowUp: [0, step],
      ArrowRight: [-step, 0],
      ArrowDown: [0, -step],
      ArrowLeft: [step, 0],
    }[event.key]

    if (translation) {
      container.call(zoom.translateBy, ...translation)
    }
  })
}

export { computeLayout, setupZoomArrowKeys, drag, renderSimulation }
