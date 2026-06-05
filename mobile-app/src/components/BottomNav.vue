<template>
  <nav class="bottom-nav" :class="{ 'has-trainer': isTrainerOrAdmin }">
    <router-link to="/dashboard" class="nav-item" active-class="active">
      <i class="pi pi-home" />
      <span>Home</span>
    </router-link>

    <router-link to="/history" class="nav-item" active-class="active">
      <i class="pi pi-calendar" />
      <span>History</span>
    </router-link>

    <!-- Center CTA -->
    <div class="nav-cta-wrap">
      <button class="nav-cta" @click="handleWorkoutStart">
        <i class="pi pi-plus" />
      </button>
    </div>

    <!-- Exercises tab (regular users) / Trainer tab (trainer/admin) -->
    <router-link
      v-if="isTrainerOrAdmin"
      to="/trainer"
      class="nav-item"
      active-class="active"
    >
      <i class="pi pi-id-card" />
      <span>Trainer</span>
    </router-link>
    <router-link v-else to="/exercises" class="nav-item" active-class="active">
      <i class="pi pi-bolt" />
      <span>Exercises</span>
    </router-link>

    <!-- Profile tab (always visible) -->
    <router-link to="/profile" class="nav-item" active-class="active">
      <i class="pi pi-user" />
      <span>Profile</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useWorkoutStore } from "@/stores/workoutStore";
import { useAuthStore } from "@/stores/authStore";

const router = useRouter();
const workout = useWorkoutStore();
const auth = useAuthStore();

const isTrainerOrAdmin = computed(
  () => auth.profile?.role === "trainer" || auth.profile?.role === "admin",
);

function handleWorkoutStart() {
  if (workout.hasActiveSession) router.push("/workout/active");
  else router.push("/workout/start");
}
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=DM+Sans:wght@400;500&display=swap");

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: grid;
  grid-template-columns: 1fr 1fr 72px 1fr 1fr;
  align-items: center;
  background: #1c1c1e;
  border-top: 1px solid #252528;
  padding: 0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom, 0px));
  height: calc(64px + env(safe-area-inset-bottom, 0px));
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.25rem;
  color: #636366;
  text-decoration: none;
  font-family: "DM Sans", sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: color 0.2s;
}
.nav-item i {
  font-size: 1.2rem;
}
.nav-item.active {
  color: #4a9eff;
}

.nav-cta-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-cta {
  width: 54px;
  height: 54px;
  background: #4a9eff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  clip-path: polygon(0 0, 100% 0, 100% 75%, 88% 100%, 0 100%);
  transition:
    background 0.2s,
    transform 0.1s;
  margin-top: -16px;
}
.nav-cta:active {
  background: #3b8eef;
  transform: scale(0.95);
}
.nav-cta i {
  font-size: 1.4rem;
}
</style>
