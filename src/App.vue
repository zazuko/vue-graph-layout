<template>
  <div class="h-full flex flex-col">
    <h1 class="p-4 text-lg font-semibold bg-gray-600 text-gray-50">Graph Layout demo</h1>
    <div class="flex-grow flex flex-row">

      <div class="w-1/3 p-4 bg-gray-100 flex flex-col gap-4">
        <label>
          Auto-zoom:
          <input type="checkbox" v-model="autoZoom" />
        </label>

        <label>
          Sample data nodes:
          <textarea v-model="nodesData" @blur="parseNodes" class="w-full text-sm" rows="10"></textarea>
        </label>

        <label>
          Sample data links:
          <textarea v-model="linksData" @blur="parseLinks" class="w-full text-sm" rows="10"></textarea>
        </label>

        <label>
          Layout config:
          <label>{{layoutCfg}}</label>
        </label>

        <div>
          Events:
          <ul class="bg-white h-48 overflow-y-scroll text-sm font-mono">
            <li v-for="(event, index) in events" :key="index">
              {{ event }}
            </li>
          </ul>
        </div>
      </div>
      <graph-layout
        :nodes="nodes"
        :links="links"
        :active-links="activeLinks"
        :auto-zoom="autoZoom"
        :layout-cfg="layoutCfg"
        @link-enter="onLinkEnter"
        @link-out="onLinkOut"
      >
        <template #node="{ node }">
          <article class="bg-primary-300 rounded-lg p-4">
            <h2 class="font-semibold">{{ node.name }}</h2>
            <ul>
              <li v-for="property in node.properties" :key="property.id">
                {{ property.name }}
              </li>
            </ul>
          </article>
        </template>
      </graph-layout>
    </div>

    <div id="menu">
      <div class="control">
      <label>Rank Direction:</label>
      <select v-model="layoutCfg.rankdir">
        <option value="TB">Top to Bottom</option>
        <option value="BT">Bottom to Top</option>
        <option value="LR">Left to Right</option>
        <option value="RL">Right to Left</option>
      </select>
      </div>
      <div class="control">
      <label>Node Separation:</label>
      <input type="range" v-model="layoutCfg.nodesep" min="10" max="100">
      </div>
      <div class="control">
      <label>Rank Separation:</label>
      <input type="range" v-model="layoutCfg.ranksep" min="10" max="100">
      </div>
    </div>

  </div>
</template>

<script>
import { onMounted, ref } from 'vue'

import GraphLayout from './components/GraphLayout.vue'

export default {
  name: 'App',
  components: { GraphLayout },

  setup () {
    const nodesData = ref(JSON.stringify([
      {
        id: 'person',
        name: 'Person',
        properties: [
          { id: 'firstName', name: 'firstName' },
          { id: 'lastName', name: 'lastName' },
          { id: 'has', name: 'has' },
        ],
      },
      { id: 'thing', name: 'Thing', properties: [{ id: 'name', name: 'name' }] },
      { id: 'job', name: 'Job', properties: [] },
      { id: 'car', name: 'Car', properties: [] },
      { id: 'house', name: 'House', properties: [] },
    ], null, 2))
    const nodes = ref([])
    const parseNodes = () => {
      nodes.value = JSON.parse(nodesData.value)
    }
    onMounted(parseNodes)

    const linksData = ref(JSON.stringify([
      { source: 'person', target: 'thing', sourceProperty: 'has', label: 'has thing' },
      { source: 'person', target: 'job', sourceProperty: 'has', label: 'has job' },
      { source: 'car', target: 'thing', label: 'made of' },
    ], null, 2))
    const links = ref([])
    const parseLinks = () => {
      links.value = JSON.parse(linksData.value)
    }
    onMounted(parseLinks)

    const layoutCfg = ref({
      rankdir: 'RL',
      align: undefined,
      nodesep: 20,
      ranksep: 50,
      marginx: 10,
      marginy: 10,
    })

    const events = ref([])
    const activeLinks = ref([])

    const onLinkEnter = (link) => {
      activeLinks.value = [link]
      events.value.push({ name: 'link-enter', data: link })
    }

    const onLinkOut = () => {
      activeLinks.value = []
      events.value.push({ name: 'link-out', data: null })
    }

    const autoZoom = ref(true)

    return {
      nodesData,
      nodes,
      parseNodes,
      linksData,
      links,
      parseLinks,
      layoutCfg,
      activeLinks,
      onLinkEnter,
      onLinkOut,
      autoZoom,
      events,
    }
  }
}
</script>

<style>
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary-50: #FFEFDE;
    --color-primary-100: #FFE2C4;
    --color-primary-200: #FFCA91;
    --color-primary-300: #FFB15E;
    --color-primary-400: #FF982B;
    --color-primary-500: #F77F00;
    --color-primary-600: #C46500;
    --color-primary-700: #914B00;
    --color-primary-800: #5E3000;
    --color-primary-900: #2B1600;

    font-size: 14px;
    line-height: 20px;
  }

  html, body, #app {
    height: 100%;
    width: 100%;
  }

  #menu {
    position: fixed;
    top: 100px;
    right: 50px;
    background-color: white;
    border: 1px solid black;
    padding: 10px;
    pointer-events: auto;
  }

  .control {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }


}
</style>
